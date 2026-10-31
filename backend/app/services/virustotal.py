"""Consulta VirusTotal por hash. No sube el archivo del estudiante."""

import json
import logging
import urllib.error
import urllib.request

from app.core.config import settings

logger = logging.getLogger("hubzy.virustotal")

_API = "https://www.virustotal.com/api/v3/files/"


def lookup_sha256(sha256: str) -> dict:
    """
    status: clean | malicious | suspicious | unknown | unavailable
    unknown = VirusTotal nunca vio ese hash. No se envía el archivo.
    """
    empty = {
        "status": "unavailable",
        "malicious": 0,
        "suspicious": 0,
    }
    key = (settings.VIRUSTOTAL_API_KEY or "").strip()
    if not key or not sha256:
        return empty

    req = urllib.request.Request(
        _API + sha256,
        headers={"x-apikey": key, "User-Agent": "hubzy-dev"},
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return {**empty, "status": "unknown"}
        logger.warning("VirusTotal respondió %s al consultar el hash.", exc.code)
        return empty
    except Exception as exc:
        logger.warning("VirusTotal no disponible: %s", exc)
        return empty

    stats = (
        (payload.get("data") or {})
        .get("attributes", {})
        .get("last_analysis_stats", {})
    )
    malicious = int(stats.get("malicious") or 0)
    suspicious = int(stats.get("suspicious") or 0)
    if malicious > 0:
        status = "malicious"
    elif suspicious > 0:
        status = "suspicious"
    else:
        status = "clean"
    return {"status": status, "malicious": malicious, "suspicious": suspicious}
