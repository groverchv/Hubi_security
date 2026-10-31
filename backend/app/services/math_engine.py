"""
Motor matemático procedural de Hubzi.

Genera problemas resolubles (no solo "qué es X") a partir de los subtemas
detectados en el documento. NO usa IA — los ejercicios salen de plantillas
parametrizadas, lo que hace la matemática:
  - instantánea (sin latencia de LLM)
  - gratis (0 tokens — el mayor ahorro de costo del producto)
  - verificable con exactitud (la respuesta se calcula, no se adivina)

Los distractores no son aleatorios: son ERRORES TÍPICOS (misconcepciones)
documentados de estudiantes. Cuando el jugador cae en una trampa, Hubzi puede
explicar exactamente por qué ese error es común.
"""

import logging
import random
import threading
from fractions import Fraction

from app.core.age_bands import get_band

# Los generadores internos usan el `random` global (61 call sites). Para que un
# seed sea determinista SIN contaminar el RNG compartido entre peticiones
# concurrentes: lock + guardar/restaurar el estado global solo en llamadas seeded.
_SEED_LOCK = threading.Lock()


def _run_seeded(seed: int, fn):
    state = random.getstate()
    with _SEED_LOCK:
        random.seed(seed)
        try:
            return fn()
        finally:
            random.setstate(state)

logger = logging.getLogger("hubzy.math_engine")

# Emoji para aritmética pictórica (sprout: 5-7 años, pre-lectores de números grandes)
_PICTO = ["🍎", "🎈", "⭐", "🐤", "🍪", "🐠", "🌸", "🚗", "⚽", "🍓"]


def _fmt_num(v) -> str:
    """Formatea un número para mostrar en carta/nodo."""
    if isinstance(v, Fraction):
        if v.denominator == 1:
            return str(v.numerator)
        return f"{v.numerator}/{v.denominator}"
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return f"{v:.2f}".rstrip("0").rstrip(".")
    return str(v)


def _problem(
    question,
    correct,
    distractors,
    concept,
    latex=None,
    hint=None,
    explanation=None,
    misconception_tags=None,
):
    """Estructura estándar de problema matemático."""
    return {
        "archetype": "solve",
        "question": question,
        "question_latex": latex,
        "correct": correct,
        "distractors": distractors,  # lista de strings de respuesta
        "misconception_tags": misconception_tags or {},
        "concept": concept,
        "hint": hint,
        "explanation": explanation,
    }


# =====================================================================
# Generadores por subtema — cada uno recibe band y devuelve un problema
# =====================================================================


def _gen_operaciones(band, level):
    """Aritmética básica: +,-,×,÷ escalando con la edad."""
    nmax = band["numbers_max"]
    if band is get_band("sprout") or nmax <= 10:
        # Pictórico: 🍎🍎🍎 + 🍎🍎 = ?
        a, b = random.randint(1, 5), random.randint(1, 4)
        op = random.choice(["+", "-"])
        if op == "-":
            a, b = max(a, b) + 1, min(a, b)
        icon = random.choice(_PICTO)
        if op == "+":
            val = a + b
            q = f"{icon * a}  +  {icon * b}  =  ?"
            words = f"{a} más {b}, ¿cuántos son?"
        else:
            val = a - b
            q = f"{icon * a}  →  quitas {b}  =  ?"
            words = f"{a} menos {b}, ¿cuántos quedan?"
        correct = _fmt_num(val)
        distract = {_fmt_num(val + d) for d in (1, -1, 2) if val + d >= 0} - {correct}
        return _problem(
            f"{q}\n\n{words}",
            correct,
            list(distract)[:3],
            concept=f"{op} hasta {nmax}",
            hint="Cuenta los dibujos despacio.",
            explanation=f"{a} {op} {b} = {val}.",
        )

    ops = ["+", "-", "×"]
    if band["numbers_max"] >= 100:
        ops.append("÷")
    op = random.choice(ops)
    span = min(nmax, 10 ** (2 + (band["numbers_max"] >= 1000)))

    a, b = random.randint(2, span), random.randint(2, max(3, span // 2))
    if op == "+":
        val = a + b
        err1, err2 = val + 1, val - 1  # error de conteo
        latex = f"{a} + {b}"
    elif op == "-":
        a, b = max(a, b), min(a, b)
        val = a - b
        err1, err2 = a + b, val + 1  # suma en vez de resta
        latex = f"{a} - {b}"
    elif op == "×":
        a, b = random.randint(2, 12), random.randint(2, 12)
        val = a * b
        err1, err2 = a * (b + 1), (a + 1) * b  # tabla confundida
        latex = f"{a} \\times {b}"
    else:  # ÷ exacta
        b = random.randint(2, 12)
        val = random.randint(2, 12)
        a = b * val
        err1, err2 = val + 1, val - 1
        latex = f"{a} \\div {b}"

    correct = _fmt_num(val)
    distract = [_fmt_num(x) for x in {err1, err2, val + 10, val - 10} if _fmt_num(x) != correct][:3]
    return _problem(
        f"Resuelve:  {a} {op} {b}  =  ?",
        correct,
        distract,
        concept=f"operación {op}",
        latex=latex + " = \\;?",
        hint="Hazlo por partes: primero las unidades.",
        explanation=f"{a} {op} {b} = {correct}.",
    )


def _gen_fracciones(band, level):
    """Fracciones: identificar → comparar → sumar, según edad."""
    if band["numbers_max"] <= 100:
        # Identificar una fracción dibujada con emoji
        den = random.choice([2, 3, 4])
        num = random.randint(1, den - 1)
        icon = random.choice(["🍕", "🍫", "🎂"])
        full, empty = "🟩", "⬜"
        bar = full * num + empty * (den - num)
        correct = f"{num}/{den}"
        distract = [f"{den - num}/{den}", f"{num}/{den + 1}", f"{num + 1}/{den}"]
        return _problem(
            f"{icon} La barra se divide en {den} partes y {num} están pintadas:\n{bar}\n\n¿Qué fracción está pintada?",
            correct,
            distract,
            concept="identificar fracciones",
            latex=f"\\frac{{{num}}}{{{den}}} = \\;?",
            hint="Cuenta cuántas partes verdes hay sobre el total.",
            explanation=f"{num} partes pintadas de {den} totales = {num}/{den}.",
            misconception_tags={distract[0]: "invirtió partes pintadas y vacías"},
        )

    # Comparar o sumar fracciones
    if level <= 3 or random.random() < 0.4:
        # Comparar ¿cuál es mayor?
        f1 = Fraction(random.randint(1, 4), random.choice([2, 3, 4, 6]))
        f2 = Fraction(random.randint(1, 5), random.choice([3, 4, 5, 8]))
        while f1 == f2:
            f2 = Fraction(random.randint(1, 5), random.choice([3, 4, 5, 8]))
        a, b = (f1, f2) if f1 > f2 else (f2, f1)
        correct = _fmt_num(a)
        distract = [_fmt_num(b), _fmt_num(Fraction(max(1, a.numerator - 1), a.denominator))]
        return _problem(
            f"¿Cuál fracción es MAYOR?   {_fmt_num(f1)}   o   {_fmt_num(f2)}",
            correct,
            distract,
            concept="comparar fracciones",
            latex=f"\\frac{{{f1.numerator}}}{{{f1.denominator}}} \\;\\text{{ó}}\\; \\frac{{{f2.numerator}}}{{{f2.denominator}}}",
            hint="Piensa en pedazos del mismo tamaño de pizza.",
            explanation=f"{correct} es mayor.",
            misconception_tags={_fmt_num(b): "comparó solo los números de arriba o abajo"},
        )

    # Sumar fracciones
    same_den = random.random() < 0.5
    if same_den:
        den = random.choice([3, 4, 5, 6, 8])
        n1, n2 = random.randint(1, den - 1), random.randint(1, den - 1)
        f = Fraction(n1 + n2, den)
        correct = _fmt_num(f)
        wrong_den_sum = _fmt_num(Fraction(n1 + n2, den * 2))  # suma denominadores
        distract = [
            wrong_den_sum,
            _fmt_num(Fraction(max(1, n1 + n2 - 1), den)),
            _fmt_num(Fraction(n1 + n2 + 1, den)),
        ]
        latex = f"\\frac{{{n1}}}{{{den}}} + \\frac{{{n2}}}{{{den}}}"
        q = f"Resuelve:   {n1}/{den} + {n2}/{den}  =  ?"
        hint = "Mismo denominador: solo suma los de arriba."
    else:
        d1, d2 = random.choice([(2, 3), (2, 4), (3, 4), (2, 5), (3, 6)])
        n1, n2 = random.randint(1, d1 - 1), random.randint(1, d2 - 1)
        f = Fraction(n1, d1) + Fraction(n2, d2)
        correct = _fmt_num(f)
        wrong_naive = _fmt_num(Fraction(n1 + n2, d1 + d2))  # LA misconcepción clásica
        distract = [wrong_naive, _fmt_num(Fraction(n1 + n2, max(d1, d2))), _fmt_num(f * 2)]
        latex = f"\\frac{{{n1}}}{{{d1}}} + \\frac{{{n2}}}{{{d2}}}"
        q = f"Resuelve:   {n1}/{d1} + {n2}/{d2}  =  ?"
        hint = "Primero busca un denominador común."
    return _problem(
        q,
        correct,
        distract,
        concept="sumar fracciones" + (" mismo denominador" if same_den else ""),
        latex=latex + " = \\;?",
        hint=hint,
        explanation=f"El resultado es {correct}.",
        misconception_tags={distract[0]: "sumó numeradores Y denominadores — el error más común"},
    )


def _gen_porcentajes(band, level):
    """Porcentajes de cantidades 'amigables'."""
    pct = random.choice([10, 20, 25, 50])
    base = random.choice([20, 40, 60, 80, 100, 200, 300])
    val = base * pct // 100
    correct = _fmt_num(val)
    distract = [_fmt_num(base - pct), _fmt_num(pct), _fmt_num(base + pct)]
    return _problem(
        f"Calcula: el {pct}% de {base}  =  ?",
        correct,
        distract,
        concept="porcentajes",
        latex=f"{pct}\\% \\;\\text{{de}}\\; {base} = \\;?",
        hint=f"{pct}% es lo mismo que {pct}/100.",
        explanation=f"{pct}% de {base} = {base}×{pct}/100 = {val}.",
        misconception_tags={_fmt_num(pct): "respondió el porcentaje, no la cantidad"},
    )


def _gen_algebra(band, level):
    """Ecuaciones de un paso o dos según edad."""
    if level <= 4 or band["numbers_max"] <= 1000:
        # x + a = b   o   a·x = b
        if random.random() < 0.5:
            x = random.randint(2, 20)
            a = random.randint(2, 15)
            b = x + a
            correct, latex = _fmt_num(x), f"x + {a} = {b}"
            distract = [_fmt_num(b + a), _fmt_num(b - a + 1), _fmt_num(a)]
            tag = {_fmt_num(b + a): "sumó en vez de restar para despejar"}
        else:
            x = random.randint(2, 12)
            a = random.randint(2, 9)
            b = a * x
            correct, latex = _fmt_num(x), f"{a}x = {b}"
            distract = [_fmt_num(b - a), _fmt_num(b + a), _fmt_num(a)]
            tag = {_fmt_num(b - a): "restó en vez de dividir para despejar"}
        return _problem(
            f"Encuentra x:   {latex.replace('x', 'x')}   →   x = ?",
            correct,
            distract,
            concept="ecuación de un paso",
            latex=latex.replace("x", "x") + "\\;\\Rightarrow\\; x = \\;?",
            hint="Pasa todo lo que no es x al otro lado.",
            explanation=f"x = {correct}.",
            misconception_tags=tag,
        )
    # ax + b = c  (challenger/scholar)
    a = random.randint(2, 9)
    x = random.randint(2, 15)
    b = random.randint(1, 20)
    c = a * x + b
    correct = _fmt_num(x)
    distract = [_fmt_num(c - b), _fmt_num(x + 1), _fmt_num(x - 1)]
    return _problem(
        f"Encuentra x:   {a}x + {b} = {c}   →   x = ?",
        correct,
        distract,
        concept="ecuación de dos pasos",
        latex=f"{a}x + {b} = {c} \\;\\Rightarrow\\; x = \\;?",
        hint="Primero resta, luego divide.",
        explanation=f"{a}x = {c - b} → x = {x}.",
        misconception_tags={_fmt_num(c - b): "olvidó dividir por el coeficiente de x"},
    )


def _gen_geometria(band, level):
    """Áreas y perímetros de figuras simples."""
    if band["numbers_max"] <= 100:
        # Contar figuras / lados
        shapes = [("triángulo", 3, "🔺"), ("cuadrado", 4, "🟦"), ("pentágono", 5, "⬟")]
        name, sides, icon = random.choice(shapes)
        return _problem(
            f"{icon} ¿Cuántos lados tiene un {name}?",
            str(sides),
            [str(sides - 1), str(sides + 1), str(4 if sides != 4 else 6)],
            concept="figuras geométricas",
            hint="Cuenta cada línea del borde.",
            explanation=f"Un {name} tiene {sides} lados.",
        )
    w, h = random.randint(3, 15), random.randint(3, 12)
    if random.random() < 0.5:
        val = w * h
        q, concept, formula = (
            f"Un rectángulo mide {w} por {h}. ¿Cuál es su ÁREA?",
            "área de rectángulo",
            f"{w} \\times {h}",
        )
        distract = [_fmt_num(2 * (w + h)), _fmt_num(w + h), _fmt_num(val + w)]
        tag = {_fmt_num(2 * (w + h)): "calculó el perímetro en vez del área"}
    else:
        val = 2 * (w + h)
        q, concept, formula = (
            f"Un rectángulo mide {w} por {h}. ¿Cuál es su PERÍMETRO?",
            "perímetro",
            f"2({w} + {h})",
        )
        distract = [_fmt_num(w * h), _fmt_num(w + h), _fmt_num(val + 2)]
        tag = {_fmt_num(w * h): "calculó el área en vez del perímetro"}
    return _problem(
        q,
        _fmt_num(val),
        distract,
        concept=concept,
        latex=formula + " = \\;?",
        hint="Área = base×altura. Perímetro = suma de los 4 lados.",
        explanation=f"El resultado es {val}.",
        misconception_tags=tag,
    )


def _gen_estadistica(band, level):
    """Media, mediana o moda de listas cortas."""
    kind = random.choice(["media", "mediana", "moda"])
    data = sorted(random.sample(range(1, 20), k=5))
    if kind == "media":
        # ajusta para que la media sea entera si es posible
        while sum(data) % len(data) != 0:
            data[random.randrange(len(data))] = random.randint(1, 20)
        val = sum(data) // len(data)
        distract = [_fmt_num(val + 1), _fmt_num(val - 1), _fmt_num(data[len(data) // 2])]
        hint = "Suma todo y divide entre cuántos números hay."
    elif kind == "mediana":
        val = data[2]
        distract = [_fmt_num(round(sum(data) / len(data))), _fmt_num(data[0]), _fmt_num(data[-1])]
        hint = "Ordena los números y agarra el del medio."
    else:
        repeated = random.choice(data)
        data = [*data, repeated, repeated]
        val = repeated
        distract = [_fmt_num(data[0]), _fmt_num(data[-1]), _fmt_num(round(sum(data) / len(data)))]
        hint = "La moda es el número que más se repite."
    return _problem(
        f"Datos: {', '.join(map(str, sorted(data)))}\n\n¿Cuál es la {kind.upper()}?",
        _fmt_num(val),
        distract,
        concept=f"estadística: {kind}",
        hint=hint,
        explanation=f"La {kind} es {val}.",
    )


def _gen_sucesiones(band, level):
    """Patrones numéricos: ¿qué sigue?"""
    kind = random.choice(["aritmética", "doble", "potencias"])
    if kind == "aritmética":
        start, step = random.randint(1, 10), random.randint(2, 9)
        seq = [start + step * i for i in range(4)]
        val = seq[-1] + step
        distract = [str(val + 1), str(val - 1), str(val + step)]
    elif kind == "doble":
        start = random.randint(1, 5)
        seq = [start * (2**i) for i in range(4)]
        val = seq[-1] * 2
        distract = [str(val // 2), str(val + 2), str(seq[-1] + start)]
    else:
        base = random.randint(2, 5)
        seq = [base**i for i in range(1, 4)]
        val = seq[-1] * base
        distract = [str(seq[-1] + base), str(base**4 + 1), str(val - base)]
    return _problem(
        f"¿Qué número sigue?\n\n{', '.join(map(str, seq))},  ?",
        _fmt_num(val),
        distract,
        concept="patrones y sucesiones",
        hint="Mira cómo cambia de un número al siguiente.",
        explanation=f"El patrón da {val}.",
    )


def _gen_razones(band, level):
    """Regla de tres directa con números amigables."""
    price = random.choice([2, 3, 4, 5, 6])
    qty = random.choice([3, 4, 5, 6, 8])
    unit = random.randint(2, 9)
    val = unit * qty
    item = random.choice(["lápices", "panes", "jugos", "cuadernos", "figuritas"])
    return _problem(
        f"Si {price} {item} cuestan {price * unit} monedas, ¿cuánto cuestan {qty} {item}?",
        _fmt_num(val),
        [_fmt_num(price * unit + qty), _fmt_num(unit * qty + 1), _fmt_num(unit * (qty - 1))],
        concept="regla de tres",
        hint="Primero averigua cuánto cuesta UNO.",
        explanation=f"1 {item[:-1]} cuesta {unit} → {qty} cuestan {val}.",
    )


def _gen_potencias(band, level):
    """Potencias exactas y raíces simples."""
    if random.random() < 0.5 or level <= 4:
        base, exp = random.randint(2, 9), random.choice([2, 3])
        val = base**exp
        sym = "²" if exp == 2 else "³"
        return _problem(
            f"Calcula:   {base}{sym}  =  ?",
            _fmt_num(val),
            [_fmt_num(base * exp), _fmt_num(base * exp + base), _fmt_num(val + base)],
            concept="potencias",
            latex=f"{base}^{{{exp}}} = \\;?",
            hint=f"{base}{sym} = {base} multiplicado por sí mismo {exp} veces.",
            explanation=f"{base}^{exp} = {val}.",
            misconception_tags={_fmt_num(base * exp): "multiplicó base por exponente"},
        )
    val = random.randint(2, 12)
    sq = val * val
    return _problem(
        f"√{sq}  =  ?",
        _fmt_num(val),
        [_fmt_num(val + 1), _fmt_num(val - 1), _fmt_num(sq // 2)],
        concept="raíces cuadradas",
        latex=f"\\sqrt{{{sq}}} = \\;?",
        hint=f"¿Qué número multiplicado por sí mismo da {sq}?",
        explanation=f"√{sq} = {val} porque {val}×{val} = {sq}.",
    )


def _gen_trigonometria(band, level):
    """Razones trigonométricas de ángulos notables (challenger/scholar)."""
    table = [
        ("sen(30°)", "1/2"),
        ("cos(60°)", "1/2"),
        ("sen(90°)", "1"),
        ("cos(0°)", "1"),
        ("tan(45°)", "1"),
        ("sen(0°)", "0"),
        ("cos(90°)", "0"),
    ]
    q, correct = random.choice(table)
    all_vals = [v for _, v in table if v != correct]
    distract = random.sample(all_vals, k=min(3, len(all_vals)))
    return _problem(
        f"¿Cuál es el valor de  {q}?",
        correct,
        distract,
        concept="trigonometría: ángulos notables",
        latex=q.replace("sen", "\\sin")
        .replace("cos", "\\cos")
        .replace("tan", "\\tan")
        .replace("°", "^{\\circ}")
        + " = \\;?",
        hint="Recuerda el triángulo unitario.",
        explanation=f"{q} = {correct}.",
    )


_GENERATORS = {
    "operaciones": _gen_operaciones,
    "fracciones": _gen_fracciones,
    "porcentajes": _gen_porcentajes,
    "algebra": _gen_algebra,
    "geometria": _gen_geometria,
    "estadistica": _gen_estadistica,
    "sucesiones": _gen_sucesiones,
    "razones_proporciones": _gen_razones,
    "potencias_raices": _gen_potencias,
    "trigonometria": _gen_trigonometria,
}

# Qué temas son accesibles por banda (números grandes = más temas)
_TOPIC_MIN_NUMBERS = {
    "operaciones": 10,
    "fracciones": 10,
    "geometria": 10,
    "sucesiones": 100,
    "porcentajes": 100,
    "razones_proporciones": 100,
    "estadistica": 1000,
    "algebra": 100,
    "potencias_raices": 1000,
    "trigonometria": 100000,
}


def generate_math_problems(
    topics: list, band_key: str, level: int, count: int, seed: int | None = None
) -> list:
    """
    Genera `count` problemas mezclando los subtemas detectados del documento,
    filtrados a los que la banda de edad puede abordar.
    """
    if seed is not None:
        return _run_seeded(seed, lambda: _generate(topics, band_key, level, count))
    return _generate(topics, band_key, level, count)


def _generate(topics: list, band_key: str, level: int, count: int) -> list:
    band = get_band(band_key)
    allowed = [
        t
        for t in topics
        if t in _GENERATORS and band["numbers_max"] >= _TOPIC_MIN_NUMBERS.get(t, 0)
    ]
    if not allowed:
        allowed = ["operaciones"]

    problems, seen_qs = [], set()
    attempts = 0
    while len(problems) < count and attempts < count * 30:
        attempts += 1
        topic = random.choice(allowed)
        try:
            p = _GENERATORS[topic](band, level)
        except Exception as gen_err:
            logger.debug(f"Generador de tópico '{topic}' falló, reintentando: {gen_err}")
            continue
        sig = p["question"] + str(p["correct"])
        if sig in seen_qs:
            continue
        seen_qs.add(sig)
        p["topic"] = topic
        problems.append(p)
    return problems
