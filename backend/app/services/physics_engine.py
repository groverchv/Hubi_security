"""
Motor de física de Hubzi — plantillas parametrizadas, 0 tokens de IA.

Dos arquetipos:
1. match: magnitud ↔ unidad ↔ símbolo (niveles bajos / bandas pequeñas)
2. solve: cálculo directo con números amigables (v=d/t, F=ma, etc.)

Distractores físicos = errores típicos documentados: confusión de unidades
(km/h vs m/s), masa vs peso, inversión de fórmulas.
"""

import logging
import random
import threading

from app.core.age_bands import get_band

logger = logging.getLogger("hubzy.physics_engine")

# Mismo patrón que math_engine: lock + save/restore del RNG global para que el
# seed llegue a los generadores internos sin contaminar otras peticiones.
_SEED_LOCK = threading.Lock()


def _run_seeded(seed: int, fn):
    state = random.getstate()
    with _SEED_LOCK:
        random.seed(seed)
        try:
            return fn()
        finally:
            random.setstate(state)

# Tabla de magnitudes fundamentales del SI — base del juego de matching
MAGNITUDES = [
    {"name": "masa", "symbol": "m", "unit": "kg", "unit_name": "kilogramo"},
    {"name": "tiempo", "symbol": "t", "unit": "s", "unit_name": "segundo"},
    {"name": "longitud", "symbol": "l", "unit": "m", "unit_name": "metro"},
    {"name": "temperatura", "symbol": "T", "unit": "K", "unit_name": "kelvin"},
    {"name": "corriente eléctrica", "symbol": "I", "unit": "A", "unit_name": "amperio"},
    {"name": "cantidad de sustancia", "symbol": "n", "unit": "mol", "unit_name": "mol"},
    {"name": "intensidad luminosa", "symbol": "Iv", "unit": "cd", "unit_name": "candela"},
]

MAGNITUDES_DERIVADAS = [
    {"name": "fuerza", "symbol": "F", "unit": "N", "unit_name": "newton"},
    {"name": "energía", "symbol": "E", "unit": "J", "unit_name": "joule"},
    {"name": "potencia", "symbol": "P", "unit": "W", "unit_name": "watt"},
    {"name": "presión", "symbol": "p", "unit": "Pa", "unit_name": "pascal"},
    {"name": "frecuencia", "symbol": "f", "unit": "Hz", "unit_name": "hertz"},
    {"name": "carga eléctrica", "symbol": "q", "unit": "C", "unit_name": "coulomb"},
    {"name": "voltaje", "symbol": "V", "unit": "V", "unit_name": "volt"},
    {"name": "resistencia", "symbol": "R", "unit": "Ω", "unit_name": "ohmio"},
    {"name": "velocidad", "symbol": "v", "unit": "m/s", "unit_name": "metro por segundo"},
    {
        "name": "aceleración",
        "symbol": "a",
        "unit": "m/s²",
        "unit_name": "metro por segundo cuadrado",
    },
]

# Fórmulas de cinemática/dinámica con números amigables para 'solve'
_FORMULAS = [
    {
        "name": "velocidad media",
        "latex": "v = \\frac{d}{t}",
        "vars": {"d": (10, 300), "t": (2, 15)},
        "solve": lambda d, t: d / t,
        "units": "m/s",
        "statement": "Un objeto recorre {d} metros en {t} segundos. ¿Cuál es su velocidad media?",
        "misconceptions": ["invirtió la fórmula (t/d)", "usó unidades distintas"],
    },
    {
        "name": "segunda ley de Newton",
        "latex": "F = m \\cdot a",
        "vars": {"m": (2, 50), "a": (1, 10)},
        "solve": lambda m, a: m * a,
        "units": "N",
        "statement": "Una masa de {m} kg se acelera a {a} m/s². ¿Qué fuerza se aplica?",
        "misconceptions": ["sumó m+a en vez de multiplicar", "confundió masa con peso"],
    },
    {
        "name": "trabajo mecánico",
        "latex": "W = F \\cdot d",
        "vars": {"F": (5, 100), "d": (2, 20)},
        "solve": lambda F, d: F * d,
        "units": "J",
        "statement": "Una fuerza de {F} N desplaza un objeto {d} m. ¿Cuál es el trabajo?",
        "misconceptions": ["dividió F/d en vez de multiplicar", "confundió trabajo con potencia"],
    },
    {
        "name": "densidad",
        "latex": "\\rho = \\frac{m}{V}",
        "vars": {"m": (10, 500), "V": (2, 50)},
        "solve": lambda m, V: m / V,
        "units": "kg/m³",
        "statement": "Un cuerpo de {m} kg ocupa {V} m³. ¿Cuál es su densidad?",
        "misconceptions": ["multiplicó m×V", "invirtió la fórmula (V/m)"],
    },
    {
        "name": "ley de Ohm",
        "latex": "V = I \\cdot R",
        "vars": {"I": (1, 10), "R": (2, 20)},
        "solve": lambda I, R: I * R,  # noqa: E741 -- I y R son la notación física estándar (corriente, resistencia)
        "units": "V",
        "statement": "Una corriente de {I} A pasa por una resistencia de {R} Ω. ¿Cuál es el voltaje?",
        "misconceptions": ["confundió corriente con voltaje", "sumó en vez de multiplicar"],
    },
    {
        "name": "presión",
        "latex": "p = \\frac{F}{A}",
        "vars": {"F": (10, 200), "A": (2, 20)},
        "solve": lambda F, A: F / A,
        "units": "Pa",
        "statement": "Una fuerza de {F} N actúa sobre {A} m². ¿Cuál es la presión?",
        "misconceptions": ["multiplicó F×A", "confundió presión con fuerza"],
    },
    {
        "name": "energía cinética",
        "latex": "E_c = \\frac{1}{2} m v^2",
        "vars": {"m": (2, 20), "v": (2, 10)},
        "solve": lambda m, v: 0.5 * m * v * v,
        "units": "J",
        "statement": "Un cuerpo de {m} kg se mueve a {v} m/s. ¿Cuál es su energía cinética?",
        "misconceptions": ["olvidó el ½", "usó v en vez de v²", "confundió con energía potencial"],
    },
    {
        "name": "energía potencial",
        "latex": "E_p = m \\cdot g \\cdot h",
        "vars": {"m": (2, 30), "h": (2, 20)},
        "solve": lambda m, h: m * 9.8 * h,
        "units": "J",
        "statement": "Una masa de {m} kg está a {h} m de altura. ¿Cuál es su energía potencial? (g = 9.8 m/s²)",
        "misconceptions": ["usó g=10 en vez de 9.8", "olvidó multiplicar por h"],
    },
]


def _fmt(v) -> str:
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return f"{v:.2f}".rstrip("0").rstrip(".")
    return str(v)


def _magnitude_match(band, level):
    """Arquetipo match: magnitud ↔ unidad (o ↔ símbolo)."""
    pool = (
        MAGNITUDES + MAGNITUDES_DERIVADAS if level > 2 or band["numbers_max"] >= 100 else MAGNITUDES
    )
    mag = random.choice(pool)
    field = random.choice(["unit", "symbol"]) if level > 3 else "unit"

    if field == "unit":
        correct = mag["unit"]
        prompt = f"¿En qué unidad se mide la magnitud '{mag['name']}'?"
        wrong_pool = [m["unit"] for m in pool if m["unit"] != correct]
        hint = f"{mag['name']} se simboliza '{mag['symbol']}'."
    else:
        correct = mag["symbol"]
        prompt = f"¿Qué símbolo representa la magnitud '{mag['name']}'?"
        wrong_pool = [m["symbol"] for m in pool if m["symbol"] != correct]
        hint = f"{mag['name']} se mide en {mag['unit_name']} ({mag['unit']})."

    distract = random.sample(wrong_pool, k=min(3, len(wrong_pool)))
    return {
        "archetype": "solve",
        "question": prompt,
        "question_latex": None,
        "correct": correct,
        "distractors": distract,
        "misconception_tags": dict.fromkeys(
            distract, "confundió la unidad/símbolo con otra magnitud"
        ),
        "concept": f"magnitud: {mag['name']}",
        "hint": hint,
        "explanation": f"{mag['name']} → {mag['symbol']} en {mag['unit_name']} ({mag['unit']}).",
        "topic": "magnitudes_unidades",
    }


def _formula_solve(band, level):
    """Arquetipo solve: cálculo directo con fórmula física."""
    formula = random.choice(_FORMULAS)
    var_ranges = formula["vars"]
    values = {k: random.randint(*r) for k, r in var_ranges.items()}
    val = formula["solve"](**values)

    # Números "amigables" — intenta conseguir resultado entero en algunos casos
    correct = _fmt(round(val, 2))
    distract = set()
    for delta in (1, -1, 2):
        dv = val + delta
        if dv > 0 and _fmt(dv) != correct:
            distract.add(_fmt(dv))
    # Errores de fórmula típicos
    if "d" in values and "t" in values:  # v = d/t → error t/d
        if values["d"]:
            distract.add(_fmt(values["t"] / values["d"]))
    if "m" in values and "a" in values:  # F = m·a → error m+a
        distract.add(_fmt(values["m"] + values["a"]))
    distract.discard(correct)
    distract = list(distract)[:3]
    while len(distract) < 3:
        cand = _fmt(val + len(distract) + 3)
        if cand != correct:
            distract.append(cand)

    statement = formula["statement"].format(**values)
    return {
        "archetype": "solve",
        "question": statement,
        "question_latex": formula["latex"] + " = \\;?",
        "correct": correct,
        "distractors": distract,
        "misconception_tags": {
            d: formula["misconceptions"][i % len(formula["misconceptions"])]
            for i, d in enumerate(distract)
        },
        "concept": formula["name"],
        "hint": f"Usa la fórmula {formula['name']}: sustituye y calcula.",
        "explanation": f"El resultado es {correct} {formula['units']}.",
        "topic": formula["name"].split()[0],
    }


def _unit_conversion(band, level):
    """Arquetipo: conversión de unidades (error típico km/h vs m/s)."""
    convs = [
        (
            "km/h → m/s",
            lambda v: v / 3.6,
            "Un vehículo va a {v} km/h. ¿Cuánto es en m/s?",
            "m/s",
            "dividir entre 3.6",
            "confundió con multiplicar por 3.6",
        ),
        (
            "m → cm",
            lambda v: v * 100,
            "{v} metros equivalen a ¿cuántos centímetros?",
            "cm",
            "multiplicar por 100",
            "dividió en vez de multiplicar",
        ),
        (
            "g → kg",
            lambda v: v / 1000,
            "{v} gramos equivalen a ¿cuántos kilogramos?",
            "kg",
            "dividir entre 1000",
            "multiplicó en vez de dividir",
        ),
        (
            "min → s",
            lambda v: v * 60,
            "{v} minutos equivalen a ¿cuántos segundos?",
            "s",
            "multiplicar por 60",
            "usó factor 100 en vez de 60",
        ),
    ]
    name, conv, template, unit, method, misconception = random.choice(convs)
    base = random.choice([2, 4, 5, 8, 10, 20, 36, 72, 90, 120, 180, 360])
    if "3.6" in method:
        base = random.choice([36, 72, 90, 108, 180])
    val = conv(base)
    correct = _fmt(val)
    # Distractores = error de dirección de la conversión + ±10%
    distract = {
        _fmt(base * 3.6) if "3.6" in method else _fmt(base / 100 if "100" in method else base * 60),
        _fmt(val * 10),
        _fmt(val / 10),
    }
    distract.discard(correct)
    distract = list(distract)[:3]
    while len(distract) < 3:
        cand = _fmt(val + len(distract) + 1)
        distract.append(cand)

    return {
        "archetype": "solve",
        "question": template.format(v=base),
        "question_latex": None,
        "correct": correct,
        "distractors": distract,
        "misconception_tags": {distract[0]: misconception if distract else "error de conversión"},
        "concept": f"conversión {name}",
        "hint": f"Para {name}: {method}.",
        "explanation": f"{base} → {correct} {unit}.",
        "topic": "conversiones",
    }


_GENERATORS = [
    _magnitude_match,
    _formula_solve,
    _unit_conversion,
]


def generate_physics_problems(
    band_key: str, level: int, count: int, seed: int | None = None
) -> list:
    """Genera `count` problemas de física mezclando los 3 arquetipos."""
    if seed is not None:
        return _run_seeded(seed, lambda: _generate(band_key, level, count))
    return _generate(band_key, level, count)


def _generate(band_key: str, level: int, count: int) -> list:
    band = get_band(band_key)

    # Bandas pequeñas: solo magnitudes (arquetipo match); conversiones desde explorer
    if band["numbers_max"] <= 10:
        gens = [_magnitude_match]
    elif band["numbers_max"] <= 100:
        gens = [_magnitude_match, _unit_conversion]
    else:
        gens = _GENERATORS

    problems, seen = [], set()
    attempts = 0
    while len(problems) < count and attempts < count * 30:
        attempts += 1
        gen = random.choice(gens)
        try:
            p = gen(band, level)
        except Exception as gen_err:
            logger.debug(f"Generador de física falló, reintentando: {gen_err}")
            continue
        sig = p["question"] + p["correct"]
        if sig in seen:
            continue
        seen.add(sig)
        problems.append(p)
    return problems
