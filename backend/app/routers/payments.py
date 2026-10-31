import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import db_manager
from app.core.rate_limit import limiter
from app.core.security import get_current_user, utcnow_iso
from app.routers.institutions import (
    _activate_school_subscription,
    _can_manage,
    _cancel_school_subscription,
    _get_institution,
)

logger = logging.getLogger("hubzy.payments")
router = APIRouter(prefix="/api/v1/payments", tags=["Monetization"])


def _stripe():
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY
    if not stripe.api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La clave secreta de Stripe no está configurada.",
        )
    return stripe


async def _upgrade_user_to_pro(
    user_id: str, customer_id: str | None = None, subscription_id: str | None = None
):
    if db_manager.db is None:
        return
    from bson import ObjectId

    query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
    # Si la escritura falla, el error propaga: el webhook de Stripe devuelve
    # 500 y Stripe reintenta hasta confirmar el upgrade del usuario que pagó.
    await db_manager.db["users"].update_one(
        query,
        {
            "$set": {
                "plan": "pro",
                "pro_since": utcnow_iso(),
                "stripe_customer": customer_id,
                "stripe_subscription": subscription_id,
            }
        },
    )
    logger.info(f"Usuario {user_id} actualizado al Plan PRO.")


async def _downgrade_user(customer_id: str):
    if db_manager.db is None:
        return
    await db_manager.db["users"].update_one(
        {"stripe_customer": customer_id},
        {"$set": {"plan": "free"}, "$unset": {"stripe_subscription": ""}},
    )
    logger.info(f"Suscripción cancelada para customer {customer_id}; usuario vuelve a plan free.")


class CreateCheckoutSessionRequest(BaseModel):
    user_id: str | None = None  # ignorado: el user real viene del JWT
    email: str | None = None
    plan_id: str = "pro_monthly"
    success_url: str | None = None
    cancel_url: str | None = None


@router.post("/create-checkout-session")
@limiter.limit("5/minute")
async def create_checkout_session(
    request: Request,
    payload: CreateCheckoutSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Crea una sesión de Stripe Checkout para la SUSCRIPCIÓN Hubzy Pro.
    Requiere sesión autenticada — el usuario del pago es el del token.
    """
    stripe = _stripe()

    user_id = str(current_user.get("id") or current_user.get("_id"))
    email = current_user.get("email") or (
        payload.email if payload.email and "@" in payload.email else None
    )
    frontend = settings.FRONTEND_URL.rstrip("/")
    success_url = payload.success_url or f"{frontend}/?payment=success"
    cancel_url = payload.cancel_url or f"{frontend}/?payment=cancelled"

    try:
        if settings.STRIPE_PRICE_ID:
            # Suscripción mensual real
            session = stripe.checkout.Session.create(
                line_items=[{"price": settings.STRIPE_PRICE_ID, "quantity": 1}],
                mode="subscription",
                customer_email=email,
                client_reference_id=user_id,
                success_url=f"{success_url}&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=cancel_url,
                metadata={"user_id": user_id, "plan_id": payload.plan_id},
            )
        else:
            # Sin STRIPE_PRICE_ID: suscripción mensual con precio inline
            # (price_data + recurring — no requiere producto pre-creado).
            session = stripe.checkout.Session.create(
                line_items=[
                    {
                        "price_data": {
                            "currency": "usd",
                            "product_data": {
                                "name": "Hubzy Pro (Estudiante Zen)",
                                "description": "Carpetas ilimitadas, más preguntas por juego y 'pregúntale a tus apuntes' con Hubzi IA.",
                            },
                            "unit_amount": 299,
                            "recurring": {"interval": "month"},
                        },
                        "quantity": 1,
                    }
                ],
                mode="subscription",
                customer_email=email,
                client_reference_id=user_id,
                success_url=f"{success_url}&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=cancel_url,
                metadata={"user_id": user_id, "plan_id": payload.plan_id},
            )

        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            "mode": session.mode,
        }
    except Exception as e:
        logger.error(f"Error creando sesión de Stripe Checkout: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error en Stripe: {e!s}"
        ) from e


@router.get("/verify-session/{session_id}")
@limiter.limit("30/minute")
async def verify_payment_session(
    request: Request,
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Verifica que una sesión de checkout fue pagada y mejora el plan del usuario autenticado."""
    stripe = _stripe()

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        logger.error(f"Error verificando sesión Stripe: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error al verificar pago: {e!s}"
        ) from e

    # "complete" con payment_status "unpaid" ocurre con métodos asíncronos —
    # solo "paid"/"no_payment_required" significan dinero confirmado.
    is_paid = session.payment_status in ("paid", "no_payment_required")
    meta = session.metadata.to_dict() if session.metadata else {}
    session_user = session.client_reference_id or meta.get("user_id")
    uid = str(current_user.get("id") or current_user.get("_id"))

    if meta.get("kind") == "school":
        # Licencia institucional: solo el admin de esa institución la activa.
        inst_id = meta.get("institution_id") or session_user
        inst = await _get_institution(inst_id) if inst_id else None
        if not inst:
            raise HTTPException(status_code=404, detail="Institución no encontrada.")
        if not _can_manage(current_user, inst):
            raise HTTPException(
                status_code=403, detail="Solo el administrador activa la licencia."
            )
        if is_paid:
            await _activate_school_subscription(
                inst_id,
                seats=int(meta.get("seats") or 0),
                customer_id=session.customer,
                subscription_id=getattr(session, "subscription", None),
            )
        return {
            "status": "success" if is_paid else "pending",
            "is_paid": is_paid,
            "institution_id": inst_id,
            "amount_total": session.amount_total,
            "currency": session.currency,
            "mode": session.mode,
        }

    # El pago solo puede acreditar al dueño de la sesión de checkout
    if is_paid and session_user and session_user != uid:
        raise HTTPException(status_code=403, detail="Esta sesión de pago no pertenece a tu cuenta.")

    # Fuera del try de Stripe: un fallo de MongoDB debe ser 500 (reintento), no 400.
    if is_paid and session_user:
        await _upgrade_user_to_pro(
            session_user,
            customer_id=session.customer,
            subscription_id=getattr(session, "subscription", None),
        )

    return {
        "status": "success" if is_paid else "pending",
        "is_paid": is_paid,
        "user_id": session_user,
        "amount_total": session.amount_total,
        "currency": session.currency,
        "mode": session.mode,
    }


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request):
    """
    Webhook oficial de Stripe con verificación de firma.
    Maneja: checkout.session.completed, customer.subscription.deleted/updated.
    """
    stripe = _stripe()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET no configurado; webhook rechazado.")
        raise HTTPException(status_code=500, detail="Webhook no configurado.")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.warning(f"Firma de webhook Stripe inválida: {e}")
        raise HTTPException(status_code=400, detail="Firma inválida.") from e

    event = event.to_dict_recursive()
    etype = event["type"]
    data = event["data"]["object"]

    if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        meta = data.get("metadata") or {}
        # En métodos asíncronos 'completed' llega con payment_status 'unpaid':
        # el fulfillment real es async_payment_succeeded. Sin pago confirmado,
        # no se activa nada.
        paid = data.get("payment_status") in ("paid", "no_payment_required")
        if not paid:
            logger.info("Checkout completado sin pago confirmado; se espera async_payment_succeeded.")
        elif meta.get("kind") == "school":
            inst_id = meta.get("institution_id") or data.get("client_reference_id")
            if inst_id:
                await _activate_school_subscription(
                    inst_id,
                    seats=int(meta.get("seats") or 0),
                    customer_id=data.get("customer"),
                    subscription_id=data.get("subscription"),
                )
        else:
            user_id = data.get("client_reference_id") or meta.get("user_id")
            if user_id:
                await _upgrade_user_to_pro(
                    user_id,
                    customer_id=data.get("customer"),
                    subscription_id=data.get("subscription"),
                )
    elif etype in ("customer.subscription.deleted", "customer.subscription.canceled"):
        customer_id = data.get("customer")
        if customer_id:
            await _downgrade_user(customer_id)
            # También puede ser la licencia de una institución
            await _cancel_school_subscription(customer_id)
    elif etype == "invoice.payment_failed":
        logger.warning(f"Pago de suscripción fallido para customer {data.get('customer')}")

    return {"received": True}
