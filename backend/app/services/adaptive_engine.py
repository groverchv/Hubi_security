"""
Motor adaptativo de Hubzi — Bayesian Knowledge Tracing (BKT).

Rastrea P(dominio) de cada habilidad por jugador y decide si el siguiente
nivel debe subir, mantenerse o bajar. Funciona con pocos datos (a diferencia
de DKT, que requiere ~50k interacciones — roadmap A6).

Modelo estándar de 4 parámetros (Corbett & Anderson, 1994):
    p_init   P(conocimiento previo)
    p_learn  P(aprender la habilidad en cada oportunidad)
    p_guess  P(acierto | no domina)
    p_slip   P(error | domina)

Las habilidades se identifican por (user_id, domain, topic) — p.ej.
("user_x", "matematica", "fracciones"). Se persisten en MongoDB con
fallback en memoria.
"""

import logging

from app.core.database import db_manager
from app.core.security import utcnow_iso

logger = logging.getLogger("hubzy.adaptive")

# Parámetros BKT por banda de edad — niños: más guess (opciones pocas),
# menos slip (errores = no sabía, no descuido); scholar: más slip posible.
BKT_PARAMS = {
    "sprout": {"p_init": 0.15, "p_learn": 0.25, "p_guess": 0.30, "p_slip": 0.08},
    "explorer": {"p_init": 0.20, "p_learn": 0.22, "p_guess": 0.25, "p_slip": 0.08},
    "adventurer": {"p_init": 0.25, "p_learn": 0.20, "p_guess": 0.20, "p_slip": 0.10},
    "challenger": {"p_init": 0.30, "p_learn": 0.18, "p_guess": 0.15, "p_slip": 0.12},
    "scholar": {"p_init": 0.30, "p_learn": 0.15, "p_guess": 0.12, "p_slip": 0.12},
    "pro": {"p_init": 0.35, "p_learn": 0.15, "p_guess": 0.10, "p_slip": 0.12},
}

MASTERY_THRESHOLD = 0.85  # P(dominio) para considerar la habilidad aprendida
_STRUGGLE_THRESHOLD = 0.40  # por debajo → bajar dificultad

_MEM_MASTERY: dict[str, dict] = {}  # fallback sin Mongo


def _key(user_id: str, domain: str, topic: str) -> str:
    return f"{user_id}:{domain}:{topic}"


async def get_mastery(user_id: str, domain: str, topic: str, band_key: str = "scholar") -> float:
    """P(dominio) actual de la habilidad — p_init si no hay historial.

    Async porque lee MongoDB de verdad: la versión sync solo consultaba la
    memoria y con Mongo activo SIEMPRE devolvía p_init — el motor adaptativo
    quedaba mudo en producción (recomendaciones congeladas en los priors)."""
    params = BKT_PARAMS.get(band_key, BKT_PARAMS["scholar"])
    doc = await _load_mastery_doc(user_id, domain, topic)
    if doc:
        return doc["p_know"]
    return params["p_init"]


async def _load_mastery_doc(user_id: str, domain: str, topic: str) -> dict | None:
    if db_manager.db is not None:
        try:
            return await db_manager.db["skill_mastery"].find_one(
                {"user_id": user_id, "domain": domain, "topic": topic}
            )
        except Exception as e:
            logger.warning(f"Error leyendo mastery de Mongo: {e}")
    return _MEM_MASTERY.get(_key(user_id, domain, topic))


async def _save_mastery_doc(user_id: str, domain: str, topic: str, doc: dict):
    if db_manager.db is not None:
        try:
            await db_manager.db["skill_mastery"].update_one(
                {"user_id": user_id, "domain": domain, "topic": topic},
                {"$set": doc},
                upsert=True,
            )
            return
        except Exception as e:
            logger.warning(f"Error guardando mastery en Mongo: {e}")
    _MEM_MASTERY[_key(user_id, domain, topic)] = doc


def bkt_update(p_know: float, correct: bool, params: dict) -> float:
    """
    Actualización bayesiana clásica:
      posterior = P(domina | evidencia)
      luego propaga con probabilidad de aprendizaje.
    """
    p_guess, p_slip, p_learn = params["p_guess"], params["p_slip"], params["p_learn"]
    if correct:
        num = p_know * (1 - p_slip)
        den = num + (1 - p_know) * p_guess
    else:
        num = p_know * p_slip
        den = num + (1 - p_know) * (1 - p_guess)
    posterior = num / den if den else p_know
    # Propagación de aprendizaje entre oportunidades
    return posterior + (1 - posterior) * p_learn


async def record_attempt(
    user_id: str,
    domain: str,
    topic: str,
    correct: bool,
    band_key: str = "scholar",
    response_ms: int | None = None,
) -> dict:
    """
    Registra un intento y devuelve la nueva P(dominio) + recomendación.
    """
    params = BKT_PARAMS.get(band_key, BKT_PARAMS["scholar"])
    doc = await _load_mastery_doc(user_id, domain, topic)
    if doc:
        p_know = doc["p_know"]
        attempts = doc.get("attempts", 0) + 1
        successes = doc.get("successes", 0) + (1 if correct else 0)
        streak = doc.get("streak", 0)
        streak = streak + 1 if correct else 0
    else:
        p_know = params["p_init"]
        attempts, successes, streak = 1, int(correct), int(correct)

    new_p = bkt_update(p_know, correct, params)

    await _save_mastery_doc(
        user_id,
        domain,
        topic,
        {
            "user_id": user_id,
            "domain": domain,
            "topic": topic,
            "p_know": new_p,
            "attempts": attempts,
            "successes": successes,
            "streak": streak,
            "band_key": band_key,
            "last_attempt_ms": response_ms,
            "updated_at": utcnow_iso(),
        },
    )

    recommendation = recommend_next(new_p, streak)
    return {
        "p_mastery": round(new_p, 3),
        "mastered": new_p >= MASTERY_THRESHOLD,
        "attempts": attempts,
        "recommendation": recommendation,
    }


def recommend_next(p_mastery: float, streak: int = 0) -> dict:
    """
    Decide qué hacer a continuación según P(dominio):
      >= 0.85 → subir dificultad / avanzar nivel
      0.40-0.85 → mantener nivel
      < 0.40    → bajar dificultad + ofrecer repaso/pista
    """
    if p_mastery >= MASTERY_THRESHOLD and streak >= 2:
        return {
            "action": "level_up",
            "difficulty_delta": 1,
            "reason": "Dominio demostrado — sube de nivel",
        }
    if p_mastery >= MASTERY_THRESHOLD:
        return {
            "action": "advance",
            "difficulty_delta": 0,
            "reason": "Dominado — sigue con el siguiente reto",
        }
    if p_mastery < _STRUGGLE_THRESHOLD:
        return {
            "action": "remediate",
            "difficulty_delta": -1,
            "reason": "Necesita apoyo — baja dificultad y repasa",
        }
    return {"action": "practice", "difficulty_delta": 0, "reason": "Practicando — mantén el nivel"}


async def get_user_skill_map(user_id: str) -> dict:
    """Mapa de habilidades dominadas/en progreso para el dashboard."""
    skills = {}
    if db_manager.db is not None:
        try:
            async for doc in db_manager.db["skill_mastery"].find({"user_id": user_id}):
                skills[f"{doc['domain']}:{doc['topic']}"] = {
                    "p_mastery": round(doc["p_know"], 3),
                    "mastered": doc["p_know"] >= MASTERY_THRESHOLD,
                    "attempts": doc.get("attempts", 0),
                }
            return {"skills": skills}
        except Exception as e:
            logger.warning(f"Error leyendo skill map: {e}")
    for k, doc in _MEM_MASTERY.items():
        if k.startswith(f"{user_id}:"):
            topic_key = k.split(":", 1)[1]
            skills[topic_key] = {
                "p_mastery": round(doc["p_know"], 3),
                "mastered": doc["p_know"] >= MASTERY_THRESHOLD,
                "attempts": doc.get("attempts", 0),
            }
    return {"skills": skills}
