# Hubzy

**Arena de aprendizaje zen**: convierte tus apuntes (PDF, Word, imágenes) en un juego de memoria por niveles con **Hubzi**, una capibara compañera que cuida tu calma antes de los exámenes con técnicas de regulación emocional basadas en evidencia (TCC, respiración 4-7-8, grounding 5-4-3-2-1).

Diseño **anti-estrés**: sin vidas, sin timers, sin "game over". Los errores enseñan (pistas), las trampas se desvanecen, la racha solo suma. Precisión real por primer intento, racha de estudio diaria, repaso espaciado y feedback adaptativo (BKT) sobre temas débiles.

**Archipiélago de islas**: si un documento tiene varios temas (`Tema 1`, `Capítulo`, headings…), cada tema se convierte en una isla con su propia campaña, niveles proporcionales al contenido y preguntas que nunca mezclan temas. Sin temas detectables → isla única "General".

**Hubzy para Colegios (B2B)**: instituciones → grados/paralelos → materias (carpetas) → temas (islas). Matrícula por código de clase o CSV, progreso por estudiante, panel docente con temas débiles del curso, reportes imprimibles y licencia por seats en Stripe.

Pensado para estudiantes universitarios y colegios (target inicial: UAGRM, Bolivia). Ver `docs/exploracion-ansiedad-uagrm.md` para la investigación de base.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + Tailwind 4 + Framer Motion + React Router + Zustand + i18next |
| Backend | FastAPI + Motor (MongoDB async) + Qdrant (RAG) |
| IA | Google Gemini (extracción, voz, embeddings) + Groq (NLP clínico rápido) |
| Pagos | Stripe Checkout (suscripción Pro) + webhook firmado |
| Infra | Docker Compose · GitHub Actions CI · PWA |

## Inicio rápido

```bash
# 1. Backend
cd backend
python -m venv venv
source venv/bin/activate       # Linux / macOS
# .\venv\Scripts\Activate.ps1  # Windows PowerShell
# venv\Scripts\activate.bat    # Windows cmd
pip install -r requirements.txt
cp .env.example .env   # completa GEMINI_API_KEY, JWT_SECRET, etc.
uvicorn app.main:app --reload --port 8000

# 2. Frontend (otra terminal)
cd frontend
npm install
cp .env.example .env
npm run dev            # http://localhost:5173

# Atajo: levanta backend+frontend y libera puertos ocupados
bash scripts/dev.sh            # Linux / macOS / Git Bash
# powershell -File scripts\dev.ps1   # Windows

# 3. Todo junto con Docker (MongoDB + Qdrant incluidos)
docker compose up --build
```

## Tests

```bash
cd backend && python -m pytest tests/ -q     # 109 tests: auth JWT, IDOR, freemium, Stripe, WS auth,
                                            # adaptativo, pipeline de carpetas, islas, instituciones
cd frontend && npm test                     # Vitest: componentes y store
```

## Arquitectura

```
backend/app/
├── core/           # config, security (JWT/bcrypt), database, plans (freemium),
│                   # rate_limit (slowapi), session_store (dev sin BD)
├── routers/        # auth · users · arena · folders · institutions · zen · voice
│                   # psychology · payments · ai · adaptive · jobs · ws
├── services/       # ai_service (Gemini/Groq) · psychology_service (NLP clínico)
│                   # voice_service (edge-tts/ElevenLabs) · board_service (tableros+caché)
│                   # rag_service (embeddings Qdrant) · topic_detector (segmentación
│                   #   de temas → islas) · document_store · job_service (jobs async)
├── schemas/        # Pydantic: tablero, nodos, cartas
├── models/         # Pydantic: usuarios, auth
└── tests/          # pytest

frontend/src/
├── pages/          # LandingPage · DashboardPage · ZenPage · ArcadeArena (juego)
├── components/     # modales del juego + CrisisModal (protocolo de ayuda)
├── lib/            # api.js (fetchWithAuth+JWT) · crisis.jsx · observability (Sentry/PostHog)
├── store/          # authStore (Zustand persistente)
├── locales/        # es.json · en.json (i18n)
└── hooks/, utils/  # audio, voz de Hubzi, catálogo de mascotas (WebP)
```

## Seguridad implementada

- JWT (PyJWT) con `Authorization: Bearer` en todos los endpoints protegidos; `JWT_SECRET` es obligatorio y validado en `ENVIRONMENT=production`
- Contraseñas bcrypt con migración transparente desde el formato legado
- Autorización: `user_id` siempre sale del token (anti-IDOR); invitados con scope limitado
- Rate limiting (slowapi) en auth, generación IA, uploads y voz; storage configurable vía `RATE_LIMIT_STORAGE_URI` (redis/mongodb para multi-réplica)
- CORS restringido por `CORS_ORIGINS` (nunca `*` con credenciales)
- Stripe: checkout autenticado + webhook con verificación de firma
- Magic bytes + límite 25 MB + whitelist de extensiones en uploads; texto extraído sanitizado y acotado
- Tokens de verificación/reset de un solo uso (jti consumido en `consumed_tokens`)

## Endpoints clave

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/auth/register` `/login` | Cuenta + JWT |
| GET | `/api/v1/auth/me` | Perfil desde token |
| POST | `/api/v1/arena/generate` | Texto → tablero (caché L1/L2) |
| POST | `/api/v1/arena/upload-and-generate` | Archivo → tablero; con `folder_id` persiste + indexa |
| POST | `/api/v1/folders/{id}/upload-document` | Sube doc + indexa en Qdrant |
| POST | `/api/v1/folders/{id}/generate-game` | Tablero por nivel; `?async=true` → 202 + `job_id`; `island_id` acota al tema |
| POST | `/api/v1/folders/{id}/detect-topics` | Detecta temas → reconstruye `islands[]` (progreso preservado) |
| GET | `/api/v1/jobs/{id}` | Estado de job async (stage/progress/result) |
| POST | `/api/v1/folders/{id}/ask` | RAG: "pregúntale a tus apuntes" |
| POST | `/api/v1/institutions` `/join` | Crear colegio · matrícula por código (HUBZY-/PROF-) |
| POST | `/api/v1/institutions/{id}/grades` `/grades/{id}/folders` | Grados y materias |
| POST | `/api/v1/institutions/grades/{id}/students/bulk` | Matrícula masiva CSV con credenciales |
| POST | `/api/v1/institutions/grades/{id}/assign` | Asignar isla/materia (badge 📌) |
| GET | `/api/v1/institutions/grades/{id}/dashboard` | Panel docente: progreso × estudiante × isla + temas débiles |
| GET | `/api/v1/institutions/grades/{id}/students/{uid}/report` | Reporte individual imprimible |
| POST | `/api/v1/institutions/{id}/checkout` | Licencia por seats vía Stripe |
| POST | `/api/v1/psychology/analyze` | NLP clínico TCC + flag `is_crisis` |
| GET | `/api/v1/psychology/crisis-resources` | Recursos de derivación (configurables) |
| GET | `/api/v1/psychology/protocols` | Protocolos zen basados en evidencia |
| POST | `/api/v1/payments/create-checkout-session` | Suscripción Pro (requiere JWT) |
| POST | `/api/v1/payments/webhook` | Eventos Stripe firmados |

## Modelo freemium

| | Free | Pro ($2.99/mes) | Escuelas ($1/estudiante/mes, mín. 30) |
|---|---|---|---|
| Carpetas | 3 | Ilimitadas | Ilimitadas (materias del grado) |
| Docs/carpeta | 5 | Ilimitados | Ilimitados |
| Preguntas/juego | 8 | 30 | 30 |
| Panel docente / reportes | — | — | ✓ |

Las cuentas escolares de estudiantes se crean por código de clase o CSV
(gestionadas por el colegio, sin email real requerido).

## Protocolo de crisis

El NLP clínico puede devolver `is_crisis=true` en `/capy-ask` y `/psychology/analyze`. El frontend lo muestra con `CrisisModal` y recursos de `/psychology/crisis-resources` (configurables por `CRISIS_RESOURCES_JSON`).

> **Importante ético** (del doc de exploración): Hubzy no diagnostica ni sustituye atención profesional. Verificar los números de ayuda locales y el contacto de Bienestar UAGRM antes de producción.

## Variables de entorno

Backend: ver `backend/.env.example` (Mongo, Qdrant, Gemini, Groq, Stripe, `JWT_SECRET`, `CORS_ORIGINS`, `SENTRY_DSN`).
Frontend: ver `frontend/.env.example` (`VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`).

## Equipo

**SynapseHub** — Hackathon project convertido en startup MVP.
# Hubi_security
# Hubi_security
# Hubi_security
