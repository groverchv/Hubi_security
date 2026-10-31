FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Usuario no-root: la app no necesita privilegios.
RUN useradd --create-home --uid 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Un solo worker A PROPÓSITO: jobs en proceso, cachés en memoria y el runner
# asyncio viven en este proceso — múltiples workers dividirían el estado.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
