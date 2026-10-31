"""Analiza un archivo con VirusTotal.

Si el hash ya fue visto, usa ese informe. Si no, envía el archivo y espera
el resultado de los motores. La API pública permite unas 4 consultas por minuto.
"""

import json
import logging
import socket
import time
import urllib.error
import urllib.request
import uuid

from app.core.config import settings

logger = logging.getLogger("hubzy.virustotal")

_FILES = "https://www.virustotal.com/api/v3/files"
_ANALYSES = "https://www.virustotal.com/api/v3/analyses/"
# Tres lecturas, separadas, para no pasar el límite de 4 peticiones por minuto
# (la búsqueda del hash y el envío ya gastan dos).
_POLL_WAITS_S = (20, 25, 25)
# Frase fija del archivo de prueba EICAR. No es un virus: sirve para probar antivirus.
_EICAR_MARK = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"


def _report(status: str, malicious: int = 0, suspicious: int = 0) -> dict:
    return {
        "status": status,
        "malicious": malicious,
        "suspicious": suspicious,
    }


def _verdict(stats: dict | None) -> dict:
    stats = stats or {}
    malicious = int(stats.get("malicious") or 0)
    suspicious = int(stats.get("suspicious") or 0)
    if malicious > 0:
        status = "malicious"
    elif suspicious > 0:
        status = "suspicious"
    else:
        status = "clean"
    return _report(status, malicious, suspicious)


def _safe_filename(filename: str) -> str:
    name = (filename or "archivo").replace("\\", "/").split("/")[-1]
    cleaned = "".join(
        ch if 32 <= ord(ch) < 127 and ch not in {'"', "\\"} else "_" for ch in name
    )
    return (cleaned[:120] or "archivo")


def _request(
    url: str,
    key: str,
    data: bytes | None = None,
    content_type: str | None = None,
    timeout: int = 30,
    _retry: bool = True,
):
    headers = {
        "x-apikey": key,
        "User-Agent": "hubzy-dev",
        "Accept": "application/json",
    }
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}, None
    except urllib.error.HTTPError as exc:
        if exc.code == 429 and _retry:
            logger.warning("VirusTotal limitó las consultas. Reintento en 20 s.")
            time.sleep(20)
            return _request(url, key, data, content_type, timeout, _retry=False)
        return None, exc
    except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
        if _retry:
            logger.warning("VirusTotal no respondió a tiempo. Reintento.")
            time.sleep(3)
            return _request(url, key, data, content_type, timeout, _retry=False)
        logger.warning("VirusTotal no disponible: %s", exc)
        return None, exc
    except Exception as exc:
        logger.warning("VirusTotal no disponible: %s", exc)
        return None, exc


def _is_eicar(file_bytes: bytes, extracted_text: str) -> bool:
    if _EICAR_MARK in file_bytes:
        return True
    return _EICAR_MARK.decode() in (extracted_text or "")


def _lookup(key: str, sha256: str) -> dict | None:
    """Informe existente, o None si VirusTotal nunca vio ese hash."""
    payload, err = _request(f"{_FILES}/{sha256}", key, timeout=25)
    if isinstance(err, urllib.error.HTTPError) and err.code == 404:
        return None
    if err is not None or payload is None:
        code = getattr(err, "code", None)
        if code:
            logger.warning("VirusTotal respondió %s al consultar el hash.", code)
        return _report("unavailable")
    stats = (
        (payload.get("data") or {})
        .get("attributes", {})
        .get("last_analysis_stats", {})
    )
    return _verdict(stats)


def _upload(key: str, file_bytes: bytes, filename: str) -> str | None:
    boundary = "----HubzyVT" + uuid.uuid4().hex
    safe_name = _safe_filename(filename)
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{safe_name}"\r\n'.encode(),
        b"Content-Type: application/octet-stream\r\n\r\n",
        file_bytes,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    payload, err = _request(
        _FILES,
        key,
        data=body,
        content_type=f"multipart/form-data; boundary={boundary}",
        timeout=45,
    )
    if err is not None or not payload:
        code = getattr(err, "code", None)
        logger.warning("VirusTotal no aceptó el archivo%s.", f" ({code})" if code else "")
        return None
    return ((payload.get("data") or {}).get("id")) or None


def _poll(key: str, analysis_id: str) -> dict | None:
    """Veredicto si el análisis terminó. None si sigue en cola o falló esta lectura."""
    payload, err = _request(_ANALYSES + analysis_id, key, timeout=15)
    if err is not None or not payload:
        return None
    attributes = (payload.get("data") or {}).get("attributes") or {}
    if attributes.get("status") != "completed":
        return None
    return _verdict(attributes.get("stats"))


def scan_file(file_bytes: bytes, sha256: str, filename: str, extracted_text: str = "") -> dict:
    """
    status: clean | malicious | suspicious | eicar | pending | unavailable
    pending = se envió, pero los motores no terminaron a tiempo.
    eicar = trae la frase de prueba y VirusTotal no llegó a dar un veredicto.
    """
    key = (settings.VIRUSTOTAL_API_KEY or "").strip()
    if not key or not sha256 or not file_bytes:
        return _report("unavailable")

    # El PDF de prueba no se reenvía: el antivirus del equipo corta esa subida
    # (WinError 10060) y VirusTotal se queda sin archivo.
    if _is_eicar(file_bytes, extracted_text):
        known = _lookup(key, sha256)
        if known and known.get("status") in {"malicious", "suspicious"}:
            return known
        logger.info("Archivo de prueba EICAR en '%s'. No se reenvía a VirusTotal.", _safe_filename(filename))
        return _report("eicar")

    known = _lookup(key, sha256)
    if known is not None and known.get("status") != "unavailable":
        return known

    analysis_id = _upload(key, file_bytes, filename)
    if not analysis_id:
        return _report("unavailable")

    for wait_s in _POLL_WAITS_S:
        time.sleep(wait_s)
        verdict = _poll(key, analysis_id)
        if verdict is not None:
            return verdict

    logger.warning("VirusTotal no terminó el análisis de '%s' a tiempo.", _safe_filename(filename))
    return _report("pending")
