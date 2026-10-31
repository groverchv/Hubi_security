#!/usr/bin/env bash
# Hubzy - arranque local limpio (backend + frontend)
# Uso:   bash scripts/dev.sh        (Linux / macOS / Git Bash en Windows)
# Equivalente multiplataforma de scripts/dev.ps1.
# Mata cualquier proceso que ocupe los puertos 8000/5173 antes de arrancar.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

clear_port() {
    local port="$1" label="$2" pids=""
    # lsof (Linux/macOS) → fuser (Linux) → netstat+taskkill (Git Bash/Windows)
    if command -v lsof >/dev/null 2>&1; then
        pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)"
    elif command -v fuser >/dev/null 2>&1; then
        pids="$(fuser "$port"/tcp 2>/dev/null | tr -s ' ' '\n' | sort -u)"
    elif command -v netstat >/dev/null 2>&1 && command -v taskkill >/dev/null 2>&1; then
        pids="$(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":$port " | awk '{print $NF}' | sort -u)"
        for p in $pids; do
            [ -n "$p" ] && [ "$p" != "0" ] && [ "$p" != "4" ] || continue
            echo "[$label] liberando puerto $port (PID $p)..."
            taskkill //F //T //PID "$p" >/dev/null 2>&1
        done
        return
    fi
    for p in $pids; do
        [ -n "$p" ] || continue
        echo "[$label] liberando puerto $port (PID $p)..."
        kill "$p" 2>/dev/null || kill -9 "$p" 2>/dev/null
    done
}

echo "== Limpiando puertos =="
clear_port 8000 'backend'
clear_port 5173 'frontend'
sleep 1

# Python del venv: Scripts en Windows (tambien Git Bash), bin en Unix
PYBIN="$ROOT/backend/venv/bin/python"
[ -x "$PYBIN" ] || PYBIN="$ROOT/backend/venv/Scripts/python.exe"
[ -x "$PYBIN" ] || PYBIN="$(command -v python3 || command -v python)"

echo "== Backend (uvicorn :8000) =="
(
    cd "$ROOT/backend" || exit 1
    exec "$PYBIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACK_PID=$!

echo "== Frontend (vite :5173) =="
(
    cd "$ROOT/frontend" || exit 1
    exec npm run dev
) &
FRONT_PID=$!

cleanup() {
    echo ""
    echo "== Deteniendo procesos dev =="
    kill "$BACK_PID" "$FRONT_PID" 2>/dev/null
}
trap cleanup INT TERM

sleep 10
if command -v curl >/dev/null 2>&1; then
    HEALTH="$(curl -fsS --max-time 5 http://localhost:8000/health 2>/dev/null)" \
        && echo "Health: $HEALTH" \
        || echo "Backend aun arrancando... revisa su log."
fi
echo "Frontend: http://localhost:5173"

wait
