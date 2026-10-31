# Hubzy - arranque local limpio (backend + frontend)
# Uso:   powershell -File scripts\dev.ps1
# Mata cualquier proceso (y sus hijos) que ocupe los puertos 8000/5173,
# incluye sockets huerfanos que Windows no reporta como proceso vivo.

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot

function Clear-Port([int]$Port, [string]$Label) {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen |
            Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        if ($p -and $p -ne 0 -and $p -ne 4) {
            Write-Host "[$Label] liberando puerto $Port (PID $p + hijos)..."
            taskkill /F /T /PID $p 2>$null | Out-Null
            Stop-Process -Id $p -Force 2>$null
        }
    }
}

# Huerfanos: procesos python/node cuyo padre ya no existe (retienen sockets)
function Clear-Orphans {
    $names = 'python.exe','pythonw.exe','node.exe'
    Get-CimInstance Win32_Process |
        Where-Object { $names -contains $_.Name } |
        Where-Object {
            $_.ParentProcessId -and
            -not (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue)
        } |
        ForEach-Object {
            Write-Host "[huerfano] PID $($_.ProcessId) ($($_.Name)) eliminado"
            Stop-Process -Id $_.ProcessId -Force 2>$null
        }
}

Write-Host "== Limpiando puertos =="
Clear-Port 8000 'backend'
Clear-Port 5173 'frontend'
Clear-Orphans
Start-Sleep -Seconds 1

Write-Host "== Backend (uvicorn :8000) =="
Start-Process powershell -ArgumentList '-NoExit','-Command', `
    "cd '$root\backend'; .\venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

Write-Host "== Frontend (vite :5173) =="
Start-Process powershell -ArgumentList '-NoExit','-Command', `
    "cd '$root\frontend'; npm run dev"

Start-Sleep -Seconds 10
try {
    $h = Invoke-RestMethod 'http://localhost:8000/health' -TimeoutSec 5
    Write-Host "`nHealth: mongodb=$($h.databases.mongodb) qdrant=$($h.databases.qdrant)"
} catch {
    Write-Host "`nBackend aun arrancando... revisa su ventana."
}
Write-Host "Frontend: http://localhost:5173"
