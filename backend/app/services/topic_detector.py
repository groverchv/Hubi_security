"""
Detector de temas por documento → "Islas" de estudio.

Un documento con varios temas (libro de sociales, apuntes de 3 unidades) se
divide en secciones; cada sección se convierte en una isla con su propia
campaña de niveles, alimentada solo por el texto de ese tema — las preguntas
quedan puras, sin mezclar contenido ajeno.

Estrategia en 3 capas:
  A) Estructural (gratis): cabeceras markdown, "Tema N", "Capítulo N",
     encabezados numerados o EN MAYÚSCULAS.
  B) LLM (fallback): Gemini sugiere divisiones con frases ancla que se
     localizan en el texto completo.
  C) Último recurso: isla única "General" (comportamiento actual).
"""

import hashlib
import json
import logging
import re
from difflib import SequenceMatcher

from app.services.llm_telemetry import (
    record_gemini_usage,
    usage_elapsed_ms,
    usage_started,
)

logger = logging.getLogger("hubzy.topics")

MIN_SECTION_CHARS = 800  # una sección con menos texto se fusiona
MAX_ISLANDS = 8
CHARS_PER_LEVEL = 9000  # niveles proporcionales al tamaño del tema
MIN_LEVELS = 3
MAX_LEVELS = 10
# Toda isla es una campaña completa de 20 niveles: los sectores del tema se
# recorren en las primeras 5 y los niveles 6-20 profundizan en rondas.
ISLAND_CAMPAIGN_LEVELS = 20

# Cabeceras tipo "Tema 3:", "CAPÍTULO II", "Unidad 4", "Sección 2.1"
_HEADING_KEYWORDS = r"(?:tema|cap[ií]tulo|unidad|secci[oó]n|m[oó]dulo|parte|lecci[oó]n|bloque)"
_RE_KEYWORD_HEADING = re.compile(
    rf"^\s*({_HEADING_KEYWORDS})\s+([0-9ivxlcdm]+|[0-9]+[\.\d]*)\s*[:\.\-–—]?\s*(.*)$",
    re.IGNORECASE,
)
_RE_MD_HEADING = re.compile(r"^\s*#{1,3}\s+(.+)$")
# "1. La Edad Media" / "1) Introducción" — línea corta que empieza numerada
_RE_NUM_HEADING = re.compile(r"^\s*(\d+)[\.\)]\s+([A-ZÁÉÍÓÚÑ][^\n]{3,70})$")
# Línea corta enteramente en mayúsculas (título de sección)
_RE_CAPS_HEADING = re.compile(r"^\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-\,\:\;]{4,60})\s*$")


def _clean_title(raw: str) -> str:
    t = re.sub(r"[\s\-–—:;,]+$", "", (raw or "").strip())
    t = re.sub(r"^[#>\-\*]+", "", t).strip()
    if len(t) > 70:
        t = t[:67].rsplit(" ", 1)[0].strip() + "…"
    return t or "Sección"


def detect_sections(text: str) -> list[dict]:
    """
    Capa A: detecta secciones por estructura del texto.
    Devuelve [{title, start, end}] con rangos de caracteres sobre `text`.
    """
    if not text or len(text.strip()) < MIN_SECTION_CHARS * 2:
        return []

    lines = text.split("\n")
    offsets = []
    pos = 0
    for line in lines:
        offsets.append(pos)
        pos += len(line) + 1

    marks: list[tuple[int, str]] = []  # (char_offset, title)
    for i, line in enumerate(lines):
        s = line.strip()
        if not s or len(s) > 90:
            continue
        m = _RE_MD_HEADING.match(s)
        if m:
            marks.append((offsets[i], _clean_title(m.group(1))))
            continue
        m = _RE_KEYWORD_HEADING.match(s)
        if m:
            tail = m.group(3).strip()
            title = f"{m.group(1).strip().title()} {m.group(2)}"
            if tail and 3 <= len(tail) <= 60:
                title = f"{title}: {tail[:60]}"
            marks.append((offsets[i], _clean_title(title)))
            continue
        m = _RE_NUM_HEADING.match(s)
        if m:
            marks.append((offsets[i], _clean_title(m.group(2))))
            continue
        m = _RE_CAPS_HEADING.match(s)
        if m and not s.endswith((".", ",", ";")):
            marks.append((offsets[i], _clean_title(m.group(1))))

    if not marks:
        return []

    # Dedup de marcas demasiado juntas (<300 chars entre ellas = mismo título roto)
    filtered: list[tuple[int, str]] = []
    for off, title in marks:
        if filtered and off - filtered[-1][0] < 300:
            continue
        filtered.append((off, title))

    sections: list[dict] = []
    for idx, (off, title) in enumerate(filtered):
        end = filtered[idx + 1][0] if idx + 1 < len(filtered) else len(text)
        sections.append({"title": title, "start": off, "end": end})

    # El preámbulo antes de la primera marca (portada/intro) se anexa a la
    # primera sección para no perderlo.
    if filtered[0][0] > 0:
        sections[0]["start"] = 0

    return _merge_tiny_sections(sections)


def _merge_tiny_sections(sections: list[dict]) -> list[dict]:
    """Fusiona secciones con <MIN_SECTION_CHARS con la siguiente más grande."""
    if len(sections) <= 1:
        return sections
    merged: list[dict] = []
    for s in sections:
        size = s["end"] - s["start"]
        if merged and size < MIN_SECTION_CHARS:
            # sección pequeña: se absorbe en la anterior
            merged[-1]["end"] = s["end"]
            continue
        merged.append(dict(s))
    # si la última quedó enana, fusiónala hacia atrás
    if len(merged) > 1 and merged[-1]["end"] - merged[-1]["start"] < MIN_SECTION_CHARS:
        merged[-2]["end"] = merged[-1]["end"]
        merged.pop()
    return merged


def _name_key(name: str) -> str:
    return re.sub(r"[^a-záéíóúñ0-9 ]", "", (name or "").lower()).strip()


def island_id_for_name(name: str) -> str:
    """ID ESTABLE de isla: deriva del nombre, no de la posición.

    Los IDs posicionales (isl_1, isl_2) se re-asignaban al tema equivocado
    cuando el orden de islas cambiaba al añadir/quitar documentos, y todo lo
    que referencia un island_id (progreso por estudiante, asignaciones,
    claves de cached_boards) terminaba apuntando a otra isla. El slug+hash
    del nombre normalizado es determinista: mismo tema → mismo ID, siempre.
    """
    key = _name_key(name) or "tema"
    slug = re.sub(r"\s+", "_", key)[:28].strip("_") or "tema"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:4]
    return f"isl_{slug}_{digest}"


def _similar(a: str, b: str) -> bool:
    ka, kb = _name_key(a), _name_key(b)
    if not ka or not kb:
        return False
    if ka == kb or ka in kb or kb in ka:
        return True
    return SequenceMatcher(None, ka, kb).ratio() >= 0.75


def detect_topics_llm(text: str, filename: str = "") -> list[dict]:
    """
    Capa B: Gemini propone divisiones con frases ancla; el backend localiza
    las anclas en el texto completo. Devuelve el mismo formato que Capa A.
    """
    try:
        from app.services.ai_service import ai_service, genai_types
    except Exception:
        return []
    client = getattr(ai_service, "client", None)
    if not client or not text:
        return []

    # Muestreo del doc si es enorme: cabeza + medio + cola
    sample = text[:14_000]
    if len(text) > 40_000:
        mid = len(text) // 2
        sample = (
            text[:9_000]
            + "\n[...]\n"
            + text[mid - 4_500 : mid + 4_500]
            + "\n[...]\n"
            + text[-9_000:]
        )

    prompt = (
        "Divide este documento educativo en temas pedagógicos coherentes "
        "(máximo 6). Para cada tema devuelve su título corto y la FRASE "
        "LITERAL de 5-10 palabras con la que empieza esa sección en el texto. "
        'JSON estricto: {"topics":[{"title":"...","start_anchor":"..."}]}. '
        'Si el documento trata de un solo tema, devuelve {"topics":[]}.\n\n'
        f"DOCUMENTO ({filename}):\n{sample}"
    )
    try:
        t0 = usage_started()
        resp = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.1, max_output_tokens=600),
        )
        record_gemini_usage(resp, "gemini-2.5-flash-lite", "topics", usage_elapsed_ms(t0))
        raw = (resp.text or "").strip()
        raw = re.sub(r"^```(?:json)?|```$", "", raw).strip()
        data = json.loads(raw)
    except Exception as e:
        logger.warning(f"Detección de temas por LLM falló: {e}")
        return []

    topics = (data or {}).get("topics") or []
    anchors: list[tuple[int, str]] = []
    cursor = 0
    for t in topics[:6]:
        anchor = (t.get("start_anchor") or "").strip()
        title = _clean_title(t.get("title"))
        if not anchor:
            continue
        idx = text.find(anchor, cursor)
        if idx < 0:
            # búsqueda relajada: primeras 5 palabras
            idx = text.find(" ".join(anchor.split()[:5]), cursor)
        if idx < 0:
            continue
        anchors.append((idx, title))
        cursor = idx

    if len(anchors) < 2:
        return []
    anchors.sort(key=lambda x: x[0])
    sections = []
    for i, (off, title) in enumerate(anchors):
        end = anchors[i + 1][0] if i + 1 < len(anchors) else len(text)
        sections.append({"title": title, "start": off, "end": end})
    if anchors[0][0] > 0:
        sections[0]["start"] = 0
    return _merge_tiny_sections(sections)


def detect_document_topics(text: str, filename: str = "") -> list[dict]:
    """Pipeline completo de un doc: estructura → LLM → []."""
    sections = detect_sections(text)
    if len(sections) < 2:
        sections = detect_topics_llm(text, filename)
    return sections


def compute_total_levels(total_chars: int) -> int:
    return max(MIN_LEVELS, min(MAX_LEVELS, -(-total_chars // CHARS_PER_LEVEL)))


def rebuild_islands(folder_doc: dict) -> list[dict]:
    """
    Reconstruye folder.islands a partir de los topic_sections de los docs.
    Fusiona temas con nombres similares entre documentos y CONSERVA el
    campaign_progress de islas que ya existían (match por similitud de nombre).
    """
    docs = folder_doc.get("documents") or []
    prev_islands = folder_doc.get("islands") or []

    groups: list[dict] = []  # {name, sections:[{doc_id,start,end}], chars}
    for doc in docs:
        doc_id = doc.get("id")
        for s in doc.get("topic_sections") or []:
            title = s.get("title") or "General"
            chars = max(0, int(s.get("end", 0)) - int(s.get("start", 0)))
            placed = False
            for g in groups:
                if _similar(g["name"], title):
                    g["sections"].append({"doc_id": doc_id, "start": s["start"], "end": s["end"]})
                    g["chars"] += chars
                    placed = True
                    break
            if not placed:
                groups.append(
                    {
                        "name": title,
                        "sections": [{"doc_id": doc_id, "start": s["start"], "end": s["end"]}],
                        "chars": chars,
                    }
                )

    if not groups:
        # Sin contenido: las islas previas con progreso pasan a la lápida
        # para restaurarlo si el tema reaparece (re-subida del doc).
        graveyard = dict(folder_doc.get("_island_progress_graveyard") or {})
        for prev in prev_islands:
            prog = prev.get("campaign_progress")
            if prog:
                graveyard[_name_key(prev.get("name", ""))] = prog
        folder_doc["_island_progress_graveyard"] = graveyard
        return []

    # Los grupos más grandes primero; excedentes → una isla "Varios temas"
    groups.sort(key=lambda g: -g["chars"])
    if len(groups) > MAX_ISLANDS:
        head, tail = groups[: MAX_ISLANDS - 1], groups[MAX_ISLANDS - 1 :]
        misc = {
            "name": "Varios temas",
            "sections": [sec for g in tail for sec in g["sections"]],
            "chars": sum(g["chars"] for g in tail),
        }
        groups = [*head, misc]

    # Progreso de islas que desaparecieron (doc borrado): se guarda en una
    # "lápida" para restaurarlo si el tema reaparece con nombre similar.
    graveyard = dict(folder_doc.get("_island_progress_graveyard") or {})

    islands = []
    taken_ids: set[str] = set()
    for g in groups:
        iid = island_id_for_name(g["name"])
        n = 2
        while iid in taken_ids:  # dos temas distintos con slug idéntico
            iid = f"{island_id_for_name(g['name'])}_{n}"
            n += 1
        taken_ids.add(iid)
        island = {
            "id": iid,
            "name": g["name"],
            "source_doc_ids": sorted({s["doc_id"] for s in g["sections"] if s["doc_id"]}),
            "sections": g["sections"],  # rangos exactos → get_island_text sin re-derivar
            "char_count": g["chars"],
            "total_levels": ISLAND_CAMPAIGN_LEVELS,
        }
        # Conservar progreso si ya existía una isla con nombre similar
        for prev in prev_islands:
            if prev.get("campaign_progress") and _similar(prev.get("name", ""), g["name"]):
                island["campaign_progress"] = prev["campaign_progress"]
                break
        else:
            # Rescatar progreso huérfano de una isla homónima eliminada antes
            for key, saved in list(graveyard.items()):
                if _similar(key.replace("_", " "), g["name"]):
                    island["campaign_progress"] = saved
                    graveyard.pop(key)
                    break
        islands.append(island)

    # Islas que quedaron sin contenido → su progreso pasa a la lápida
    alive_names = [g["name"] for g in groups]
    for prev in prev_islands:
        prog = prev.get("campaign_progress")
        if prog and not any(_similar(prev.get("name", ""), n) for n in alive_names):
            graveyard[_name_key(prev.get("name", ""))] = prog

    folder_doc["_island_progress_graveyard"] = graveyard
    return islands


def get_island_text(folder_doc: dict, island_id: str) -> str:
    """Concatena el texto de las secciones que pertenecen a la isla."""
    docs = {d.get("id"): d for d in folder_doc.get("documents") or []}
    island = next(
        (i for i in (folder_doc.get("islands") or []) if i.get("id") == island_id),
        None,
    )
    if not island:
        return ""
    parts = []
    for s in island.get("sections") or []:
        doc = docs.get(s.get("doc_id"))
        if not doc:
            continue
        full = doc.get("extracted_text") or ""
        parts.append(full[s["start"] : s["end"]])
    return "\n\n".join(p for p in parts if p.strip())
