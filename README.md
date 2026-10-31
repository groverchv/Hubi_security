# Hubzy

Arena de aprendizaje: subes apuntes (PDF, Word, TXT, MD, CSV o imagen) y Hubzy arma un juego de memoria por niveles. Si el documento tiene varios temas, cada uno se vuelve una isla del archipiélago, con su propia campaña. Hubzi, la capibara, acompaña el estudio con pausas de regulación emocional.

Sin vidas, sin temporizador y sin "game over". Los errores muestran una pista.

## Probarlo en tu máquina

Necesitas:

- Python 3.11 o superior
- Node.js 20 o superior y npm
- Docker Desktop, solo para MongoDB
- Una clave de [Google Gemini](https://aistudio.google.com/apikey) o de [Groq](https://console.groq.com/keys) para generar las preguntas

La app abre en **http://localhost:5173**. El frontend reenvía `/api` al backend en el puerto **8000**.

### 1. MongoDB

En la raíz del repo:

```bash
docker compose up -d mongodb
```

La base `hubzy_db` aparece al crear la primera cuenta. En MongoDB Compass la URI es `mongodb://localhost:27017`.

### 2. Backend

```bash
cd backend
python -m venv venv
```

Activa el entorno:

```bat
venv\Scripts\activate.bat
```

```powershell
.\venv\Scripts\Activate.ps1
```

```bash
source venv/bin/activate
```

Sigue en `backend`:

```bash
pip install -r requirements.txt
copy .env.example .env
```

En Linux o macOS el último paso es `cp .env.example .env`.

Abre `backend/.env` y completa al menos:

| Variable | Para probar en local |
|---|---|
| `MONGODB_URI` | Déjala en `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | `hubzy_db` |
| `QDRANT_HOST` | `localhost` si levantas Qdrant; si no, el juego igual se genera y la búsqueda en apuntes queda desconectada |
| `GEMINI_API_KEY` o `GROQ_API_KEY` | Una de las dos, para generar el juego |
| `JWT_SECRET` | Cualquier texto largo. El valor de ejemplo sirve solo en local |
| `EMAIL_ENABLED` | `false` para no configurar correo. El aviso de verificación sale en la terminal del backend |
| `VIRUSTOTAL_API_KEY` | Opcional. Hace falta para el chequeo de archivos. Pídela en [virustotal.com/gui/my-apikey](https://www.virustotal.com/gui/my-apikey) |

Arranca:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Si cambias `.env`, reinicia este proceso. `--reload` no vuelve a leer ese archivo solo.

### 3. Frontend

En otra terminal, desde la raíz:

```bash
cd frontend
npm install
npm run dev
```

Entra a http://localhost:5173, crea una cuenta, abre una carpeta, sube un apunte y pulsa **Iniciar juego**. La primera generación puede tardar cerca de un minuto.

### Todo en Docker

Con `backend/.env` ya creado (las claves de IA van ahí):

```bash
docker compose up --build
```

Compose usa MongoDB y Qdrant de la red interna. La app queda en http://localhost:5173.

## Qué probar

**Apunte normal.** Un `.txt` o PDF de estudio. VirusTotal, si tiene clave, lo analiza. Si sale limpio, **Iniciar juego** crea las islas y el quiz.

**Prompt injection.** Al final de un apunte agrega una línea que pida ignorar las instrucciones o revelar el prompt del sistema. La carpeta muestra el fragmento, el botón de jugar queda apagado y no se genera el archipiélago.

**Archivo malicioso.** Baja el archivo de prueba oficial en [eicar.org](https://www.eicar.org/download-anti-malware-testfile/) (`eicar.com`) o sube un PDF o TXT que lleve esa frase de prueba. El archivo se marca como malicioso, **Iniciar juego** queda apagado y no se arma el quiz ni el archipiélago. Quítalo de la carpeta para volver a jugar con otro apunte.

Formatos aceptados: PDF, DOCX, TXT, MD, CSV e imagen, hasta 25 MB.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite, Tailwind 4, Framer Motion, Zustand, i18next |
| Backend | FastAPI, Motor (MongoDB), Qdrant |
| IA | Gemini y Groq |
| Archivos | VirusTotal y detección de prompt injection |
| Pagos | Stripe (opcional para probar el juego) |

## Tests

```bash
cd backend && python -m pytest tests/ -q
cd frontend && npm test
```

Si `pytest` no está instalado: `pip install pytest` dentro del entorno virtual.

## Variables de entorno

El listado completo está en `backend/.env.example` y `frontend/.env.example`. Stripe, Sentry, PostHog, ElevenLabs y el correo SMTP no hacen falta para el recorrido de arriba.

## Equipo

**SynapseHub**
