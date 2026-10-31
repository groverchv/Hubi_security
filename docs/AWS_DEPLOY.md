# Despliegue en AWS — Hubzy/SynapseHub

Guía para poner en producción el stack completo (frontend nginx + FastAPI + MongoDB + Qdrant) en una instancia **EC2** con Docker. Es el camino más directo; alternativas gestionadas al final.

## 1. Requisitos

- Instancia EC2 **Ubuntu 24.04** — `t3.medium` (2 vCPU / 4 GB) como mínimo cómodo.
- **Security Group**: abre solo `22` (SSH, restringe a tu IP), `80` y `443`. **Nunca** abras `27017` (Mongo), `6333` (Qdrant) ni `8000` (backend) — el compose de prod no los publica al host, pero el SG es la segunda muralla.
- Disco: 20 GB gp3 mínimo (imágenes ~2.5 GB + volúmenes de datos).
- Elastic IP asociada (IP fija para Stripe webhooks y DNS).

## 2. Instalar Docker

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu && newgrp docker
```

## 3. Subir el código y configurar secretos

```bash
git clone https://github.com/groverchv/Hubzi.git && cd Hubzi
cp backend/.env.example backend/.env
nano backend/.env
```

Variables **obligatorias** en `backend/.env` para producción:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 32` — la app **rechaza arrancar** con el default |
| `MONGO_ROOT_PASSWORD` | contraseña fuerte para Mongo interno |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | motor de preguntas LLM |
| `ELEVENLABS_API_KEY` | opcional — sin ella cae a Edge-TTS gratis |
| `STRIPE_*` | claves live + `STRIPE_WEBHOOK_SECRET` del endpoint creado abajo |
| `CORS_ORIGINS` | `https://tudominio.com` (el frontend va same-origin vía nginx, así que esto cubre llamadas directas a la API) |
| `FRONTEND_URL` | `https://tudominio.com` — lo usan los redirects de Stripe Checkout |
| `ADMIN_EMAILS` | emails con acceso a `/ai/training-dataset` |
| `SMTP_*` | para emails de verificación/reset (o SES — ver abajo) |

## 3b. Base de datos: Atlas (recomendado) o contenedor

**Opción A — MongoDB Atlas** (gestionado, backups incluidos):

1. Crea el cluster en [cloud.mongodb.com](https://cloud.mongodb.com) (M0 gratis sirve para empezar; M10+ para producción).
2. **Database Access** → crea un usuario app **con privilegio `readWrite` sobre `hubzy_db` solamente** — NO uses el usuario `Atlas Admin` que Atlas crea por defecto: si la app se compromete, admin total de la cuenta.
3. **Network Access** → añade la **Elastic IP del EC2** como `x.x.x.x/32`. Tu IP de casa solo sirve para probar desde tu máquina. Evita `0.0.0.0/0` salvo demo temporal.
4. Connect → Drivers → Python → copia el SRV y ponlo en `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://APPUSER:PASS@hubzi.xxxxx.mongodb.net/hubzy_db?retryWrites=true&w=majority
   ```
   (si la contraseña tiene `@`, `:` o `#`, URL-encodea: `%40`, `%3A`, `%23`)
5. Los índices (incluidos los únicos de `student_progress` y `skill_mastery`) los crea la app sola al conectar.

**Opción B — Mongo en el propio EC2** (más barato, tú lo operas):

```bash
docker compose -f docker-compose.prod.yml --env-file backend/.env --profile local-db up -d --build
```

con `MONGODB_URI=mongodb://hubzy:TU_PASS@mongodb:27017/hubzy_db?authSource=admin` y `MONGO_ROOT_PASSWORD=TU_PASS` en `.env`. El volumen `mongodb_storage` + snapshots EBS son tu backup.

## 4. Levantar

```bash
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # verificar arranque
curl localhost/health                                        # a través de nginx → /api/health real: curl localhost/api/v1/health si aplica
```

Healthcheck directo del backend (desde dentro):

```bash
docker exec hubzy-backend curl -fsS localhost:8000/health
```

## 5. HTTPS (obligatorio para Stripe y para producción real)

Opción simple — **Caddy** delante de nginx en la misma instancia:

```bash
sudo apt-get install -y caddy
echo "tudominio.com { reverse_proxy localhost:80 }" | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy   # certificado TLS automático
```

Alternativa corporativa: **ALB + ACM** (certificado gratis) terminando TLS en el balanceador y reenviando a `EC2:80`.

## 6. Stripe webhook

En Stripe Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://tudominio.com/api/v1/payments/webhook`
- Eventos: `checkout.session.completed`
- Copiar el **Signing secret** → `STRIPE_WEBHOOK_SECRET` en `.env` → `docker compose -f docker-compose.prod.yml --env-file backend/.env up -d`

## 7. Emails (SMTP) — opción AWS SES

`SMTP_HOST=email-smtp.us-east-1.amazonaws.com`, `SMTP_PORT=587`, `SMTP_USE_TLS=true`, usuario/clave SMTP de SES (distintas de las credenciales IAM), `EMAIL_FROM` verificado en SES. Sin SMTP, los emails de verificación se imprimen en el log (modo dev).

## 8. Datos, backups y límites conocidos

- **Backups**: snapshot EBS programado del volumen raíz cubre `mongodb_storage` y `qdrant_storage`. Para algo más fino: `docker exec hubzy-mongodb mongodump --archive` cron → S3.
- **Un solo worker** de uvicorn a propósito: los jobs de generación y cachés viven en memoria del proceso. Para escalar a más réplicas hace falta migrar jobs a cola persistente (Redis/SQS) — limitación documentada en `job_service.py`.
- **Rate limiter** corre en memoria por defecto; con varias réplicas usar `RATE_LIMIT_STORAGE_URI=redis://...`.
- **Mongo/Qdrant gestionados**: con Atlas, `MONGODB_URI` en `.env` ya apunta fuera y el contenedor mongo ni arranca (profile `local-db`). Igual para Qdrant Cloud (`QDRANT_URL`+`QDRANT_API_KEY`) — quita el servicio `qdrant` del compose si lo usas.

## 9. Actualizar

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
```

## Alternativas gestionadas

| Opción | Cuándo conviene |
|---|---|
| **EC2 + compose** (esta guía) | MVP/startup: 1 máquina, costo mínimo, control total |
| **ECS Fargate + DocumentDB + Qdrant Cloud** | Sin administrar el host; más costo fijo |
| **Elastic Beanstalk (Docker)** | Deploys gestionados sin salir de EC2 |
| Frontend en **S3+CloudFront** y API en ECS | Escala el estático por separado (requiere apuntar el proxy `/api` o habilitar CORS al dominio) |
