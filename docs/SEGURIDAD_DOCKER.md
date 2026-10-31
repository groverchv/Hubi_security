# Seguridad de Docker e infraestructura — Hubzy

Estado del despliegue en contenedores y de la infraestructura que lo rodea (EC2, Atlas, Qdrant Cloud, Caddy). El arranque local con `uvicorn` y `npm run dev` no usa estas imágenes: habla directo con Atlas y Qdrant Cloud. Este documento cubre el camino de producción definido en `docker-compose.prod.yml`.

El despliegue paso a paso está en [AWS_DEPLOY.md](AWS_DEPLOY.md). Aquí está el criterio de seguridad: qué ya está cerrado, qué no hace falta tocar y qué endurecimiento sigue pendiente.

## Cómo entra el tráfico

```
Internet
   │  80 / 443
   ▼
Caddy (TLS)
   │  red interna
   ▼
nginx (estáticos + proxy /api y /ws)
   │
   ▼
FastAPI :8000          MongoDB Atlas  ·  Qdrant Cloud
```

Mongo y Qdrant en contenedor solo existen con el perfil `local-db`. En el despliegue actual (Atlas + Qdrant Cloud) esos contenedores no arrancan y el backend sale a la nube con `MONGODB_URI` y `QDRANT_URL`.

## Lo que ya está bien

Estos controles ya están en el repo. No hay que rehacerlos.

| Control | Dónde |
|---|---|
| Única puerta pública: 80 y 443 | `docker-compose.prod.yml`, servicio `caddy` |
| API, Mongo y Qdrant sin puerto publicado al host | mismo archivo: `expose` en backend/frontend, sin `ports` en las bases |
| Imagen de producción inmutable (sin montar el código fuente) | servicio `backend` usa `backend/Dockerfile`, no `Dockerfile.dev` |
| Proceso del API como usuario no root (`appuser`, uid 1001) | `backend/Dockerfile` |
| Secretos fuera de la imagen | `backend/.dockerignore` y `frontend/.dockerignore` excluyen `.env` |
| Healthcheck del API y de nginx | ambos Dockerfiles |
| TLS automático | `Caddyfile` + volúmenes `caddy_data` / `caddy_config` |
| Mongo local exige usuario; sin password el comentario del compose advierte que arrancaría sin auth | perfil `local-db` |
| La app rechaza un `JWT_SECRET` por defecto si `ENVIRONMENT=production` | `backend/app/core/config.py` |
| CORS no es `*` | `CORS_ORIGINS` en el `.env` |

Con Atlas y Qdrant Cloud, la red de datos no depende de los puertos del compose: la cierra la allowlist de cada servicio (IP elástica del EC2, no `0.0.0.0/0`).

## Lo que no hay que usar en un servidor

`docker-compose.yml` es solo desarrollo:

- Publica Mongo (`27017`), Qdrant (`6333` y `6334`) y el API (`8000`) en el host.
- Mongo arranca sin autenticación.
- El backend usa `Dockerfile.dev`: root, `--reload` y el código montado desde el disco (incluye el `.env` vía el bind mount).
- Qdrant usa el tag `latest`.

En una máquina con IP pública ese archivo deja las bases a la vista. En el servidor el comando es el de producción:

```bash
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
```

## Huecos que sí conviene cerrar

Nada de esto impide desplegar. Son el endurecimiento pendiente si la tarea es seguridad de Docker e infraestructura.

1. **Tags móviles.** `qdrant/qdrant:latest`, `python:3.11-slim`, `node:20-alpine`, `nginx:1.27-alpine`, `mongo:7.0` y `caddy:2-alpine` no están fijados por digest. Una reconstrucción puede traer otra versión. Fijar digest (`imagen@sha256:…`) o, como mínimo, un tag de parche.

2. **nginx y Caddy corren como root.** El API ya no. nginx oficial necesita root para escuchar en el puerto 80; se puede pasar a `8080` con usuario `nginx` y apuntar Caddy a ese puerto. Caddy necesita privilegio para el 443, o las capabilities `NET_BIND_SERVICE` en lugar de root completo.

3. **Sin perfil de seguridad en Compose.** A cada servicio de producción le faltan:

   ```yaml
   read_only: true
   cap_drop: [ALL]
   security_opt: ["no-new-privileges:true"]
   tmpfs: ["/tmp"]
   ```

   Mongo y Qdrant necesitan su volumen de datos con escritura; el resto del filesystem puede ir en solo lectura. Caddy necesita escritura en `/data` y `/config` (ya son volúmenes).

4. **`curl` dentro de la imagen del API.** Solo existe para el healthcheck. Sustituirlo por un one-liner de Python permite quitar el paquete.

5. **Sin límites de recursos.** Un contenedor puede comerse la RAM del EC2. Poner `mem_limit` (y CPU) por servicio.

6. **Sin escaneo de imágenes.** No hay workflow que corra Trivy o `docker scout` al construir. Una dependencia con CVE entra en la imagen sin aviso.

7. **Password vacío en Mongo local.** `MONGO_ROOT_PASSWORD` tiene default vacío. Si alguien levanta `--profile local-db` sin esa variable, Mongo queda sin auth dentro de la red de Compose. El compose debería fallar el arranque si el password no está definido.

8. **Secretos visibles con `docker inspect`.** El `env_file` es correcto (no van en la imagen) y el archivo tiene que quedar fuera de git (`.gitignore` ya ignora `.env`). En el host, `chmod 600 backend/.env`. Quien tenga acceso al daemon de Docker los lee igual: el grupo `docker` equivale a root en esa máquina.

## Checklist del servidor

Esto no vive en los Dockerfiles. Hay que comprobarlo en AWS, Atlas y Qdrant.

- Security group: solo `22` (restringido a tu IP), `80` y `443`. Cerrados `27017`, `6333` y `8000`.
- SSH solo con llave. Sin login por contraseña.
- Elastic IP fija, y esa IP (no `0.0.0.0/0`) en Network Access de Atlas y en la allowlist de Qdrant Cloud.
- Usuario de Atlas con `readWrite` solo sobre `hubzy_db`, no el rol de admin de la cuenta.
- `ENVIRONMENT=production` (el compose de prod ya lo fuerza).
- `JWT_SECRET` de al menos 32 bytes aleatorios (`openssl rand -hex 32`).
- `CORS_ORIGINS` y `FRONTEND_URL` con el dominio HTTPS real, no `localhost`.
- `chmod 600 backend/.env` en el EC2.
- Backups: snapshots EBS si usas el perfil `local-db`. Con Atlas, los backups los da el cluster.

## Cómo comprobarlo

Después de levantar el compose de producción, desde el propio EC2:

```bash
# Solo Caddy debe escuchar en el host
sudo ss -tlnp | grep -E ':80|:443|:8000|:27017|:6333'

# El API responde por dentro del contenedor
docker exec hubzy-backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read())"

# El proceso del API no es root
docker exec hubzy-backend id
```

Desde fuera de la VPC, `27017`, `6333` y `8000` no deben aceptar conexión. `https://<dominio>/` sí.

Para las imágenes, en la máquina de build:

```bash
docker build -t hubzy-backend ./backend
docker build -t hubzy-frontend ./frontend
docker scout cves hubzy-backend
docker scout cves hubzy-frontend
```

## Qué no cambia el trabajo local

Mientras pruebes con `uvicorn` en el puerto 8000 y Vite en el 5173, estos archivos no intervienen. Las cuentas y los documentos sí caen en el Atlas y el Qdrant de la nube, porque el `backend/.env` apunta ahí.
