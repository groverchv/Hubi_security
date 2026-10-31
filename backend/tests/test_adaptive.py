"""
Tests del sistema adaptativo: bandas de edad, motor de dominios,
motor matemático procedural, filtro de seguridad y BKT.
"""

import pytest

from app.core.age_bands import (
    band_for_age,
    cheer_word,
    is_minor,
    needs_parental_consent,
    resolve_level_question_count,
    resolve_trap_count,
)
from app.services.adaptive_engine import BKT_PARAMS, bkt_update, recommend_next
from app.services.domain_engine import classify_domain, detect_math_topics
from app.services.math_engine import generate_math_problems
from app.services.physics_engine import generate_physics_problems
from app.services.safety_filter import (
    contains_blocked_content,
    contains_punitive_tone,
    filter_board_for_band,
    filter_text_for_band,
)

# =====================================================================
# BANDAS DE EDAD
# =====================================================================


class TestAgeBands:
    @pytest.mark.parametrize(
        "age,expected",
        [
            (5, "sprout"),
            (7, "sprout"),
            (8, "explorer"),
            (10, "explorer"),
            (12, "adventurer"),
            (14, "adventurer"),
            (16, "challenger"),
            (18, "challenger"),
            (20, "scholar"),
            (25, "scholar"),
            (28, "pro"),
            (35, "pro"),
        ],
    )
    def test_band_for_age(self, age, expected):
        assert band_for_age(age) == expected

    def test_minor_bands(self):
        assert is_minor("sprout")
        assert is_minor("explorer")
        assert is_minor("challenger")
        assert not is_minor("scholar")
        assert not is_minor("pro")
        assert not is_minor(None)

    def test_parental_consent_required_only_young(self):
        assert needs_parental_consent("sprout")
        assert needs_parental_consent("explorer")
        assert not needs_parental_consent("adventurer")
        assert not needs_parental_consent("scholar")

    def test_question_count_fixed_for_kids(self):
        # Bandas infantiles: preguntas fijas por banda, no la curva Nivel-K
        assert resolve_level_question_count("sprout", 5) == 3
        assert resolve_level_question_count("explorer", 5) == 4
        # Scholar/pro: conserva curva legacy (Nivel K = K preguntas)
        assert resolve_level_question_count("scholar", 5) == 5

    def test_no_traps_for_sprout(self):
        assert resolve_trap_count("sprout", 5, 3) == 0

    def test_cheer_word_gendered(self):
        for _ in range(20):
            assert cheer_word("masculino") in {"campeón", "genio", "crack"}
            assert cheer_word("femenino") in {"campeona", "genia", "crack"}
            assert cheer_word(None) in {"crack", "genio"}
            # nunca campeón para femenino
            assert cheer_word("femenino") != "campeón"


# =====================================================================
# CLASIFICADOR DE DOMINIOS
# =====================================================================


class TestDomainEngine:
    def test_math_text_detected(self):
        text = (
            "Las fracciones representan partes de un todo. El numerador "
            "indica las partes que tomamos y el denominador en cuántas "
            "partes se divide la unidad. Para sumar fracciones con el "
            "mismo denominador se suman los numeradores."
        )
        result = classify_domain(text)
        assert result["domain"] == "matematica"
        assert result["generator"] == "procedural"

    def test_physics_text_detected(self):
        text = (
            "La segunda ley de Newton establece que la fuerza es igual "
            "a la masa por la aceleración. La velocidad se mide en m/s "
            "y la energía cinética depende de la velocidad al cuadrado."
        )
        result = classify_domain(text)
        assert result["domain"] == "fisica"

    def test_history_text_detected(self):
        text = (
            "La revolución francesa de 1789 marcó el fin del Antiguo "
            "Régimen. La independencia de las colonias americanas "
            "transformó los imperios europeos durante el siglo XIX."
        )
        result = classify_domain(text)
        assert result["domain"] == "historia"

    def test_programming_text_detected(self):
        text = (
            "Un algoritmo es una secuencia de pasos. En Python se "
            "define una función con def y se itera con un bucle for. "
            "La recursión permite que una función se llame a sí misma."
        )
        result = classify_domain(text)
        assert result["domain"] == "programacion"

    def test_generic_text_falls_back(self):
        result = classify_domain("Este es un texto cualquiera sin tema claro.")
        assert result["domain"] == "general"

    def test_math_topics_detection(self):
        text = "Las fracciones y el porcentaje se relacionan. El numerador y denominador definen la razón."
        topics = detect_math_topics(text)
        assert "fracciones" in topics or "porcentajes" in topics


# =====================================================================
# MOTOR MATEMÁTICO PROCEDURAL
# =====================================================================

MATH_DOC = (
    "Las fracciones son expresiones matemáticas. El numerador y el "
    "denominador. También las operaciones de suma, resta, "
    "multiplicación y división son fundamentales en aritmética."
)


class TestMathEngine:
    def test_generates_requested_count(self):
        problems = generate_math_problems(
            ["fracciones", "operaciones"], "adventurer", 3, 5, seed=42
        )
        assert len(problems) == 5

    def test_problems_have_required_fields(self):
        problems = generate_math_problems(["fracciones"], "challenger", 2, 3, seed=7)
        for p in problems:
            assert p["question"]
            assert p["correct"]
            assert isinstance(p["distractors"], list)
            assert p["archetype"] == "solve"
            assert p["concept"]

    def test_distractors_differ_from_correct(self):
        problems = generate_math_problems(["operaciones"], "scholar", 3, 8, seed=11)
        for p in problems:
            assert p["correct"] not in p["distractors"], (
                f"Distractor igual a la respuesta en {p['question']}"
            )

    def test_sprout_numbers_stay_small(self):
        problems = generate_math_problems(["operaciones"], "sprout", 1, 5, seed=5)
        for p in problems:
            assert p["question"], "sprout debe tener enunciado pictórico"
            # Las respuestas deben ser números pequeños (<=10)
            try:
                assert int(p["correct"]) <= 10
            except ValueError:
                pass  # fracciones admitidas

    def test_misconception_traps_present(self):
        # En fracciones debe existir al menos un distractor con tag de misconcepción
        problems = generate_math_problems(["fracciones"], "challenger", 5, 6, seed=3)
        assert any(p["misconception_tags"] for p in problems)

    def test_deterministic_with_seed(self):
        p1 = generate_math_problems(["operaciones"], "explorer", 2, 4, seed=99)
        p2 = generate_math_problems(["operaciones"], "explorer", 2, 4, seed=99)
        assert [p["question"] for p in p1] == [p["question"] for p in p2]

    def test_unsupported_topics_fall_back_to_operaciones(self):
        problems = generate_math_problems(["topologia_avanzada"], "scholar", 1, 2, seed=1)
        assert len(problems) == 2


# =====================================================================
# MOTOR DE FÍSICA PROCEDURAL
# =====================================================================


class TestPhysicsEngine:
    def test_generates_requested_count(self):
        problems = generate_physics_problems("scholar", 3, 5, seed=42)
        assert len(problems) == 5

    def test_sprout_only_magnitudes(self):
        # Bandas pequeñas: solo matching magnitud↔unidad (sin fórmulas)
        problems = generate_physics_problems("sprout", 1, 4, seed=7)
        assert len(problems) == 4
        for p in problems:
            assert p["topic"] == "magnitudes_unidades"

    def test_explorer_adds_conversions(self):
        problems = generate_physics_problems("explorer", 2, 6, seed=3)
        topics = {p["topic"] for p in problems}
        assert "magnitudes_unidades" in topics or "conversiones" in topics

    def test_distractors_not_correct(self):
        problems = generate_physics_problems("challenger", 3, 6, seed=11)
        for p in problems:
            assert p["correct"] not in p["distractors"]

    def test_formulas_have_latex(self):
        problems = generate_physics_problems("scholar", 4, 8, seed=5)
        # Al menos un problema debe tener LaTeX de fórmula
        assert any(p["question_latex"] for p in problems)

    def test_misconceptions_documented(self):
        problems = generate_physics_problems("challenger", 3, 5, seed=13)
        assert any(p["misconception_tags"] for p in problems)


# =====================================================================
# FILTRO DE SEGURIDAD PARA MENORES
# =====================================================================


class TestSafetyFilter:
    def test_blocked_content_detected(self):
        assert contains_blocked_content("La tortura fue un método usado")
        assert contains_blocked_content("hablar de drogas ilegales como la cocaína")
        assert not contains_blocked_content("Las fracciones son divertidas")

    def test_punitive_tone_detected(self):
        assert contains_punitive_tone("Reprobaste, estudia más")
        assert contains_punitive_tone("Respuesta incorrecta")
        assert not contains_punitive_tone("¡Casi! Inténtalo otra vez")

    def test_minors_get_blocked_text_replaced(self):
        bad = "La tortura era común en esa época"
        filtered = filter_text_for_band(bad, "explorer")
        assert "tortura" not in filtered.lower()

    def test_adults_unaffected(self):
        text = "La guerra de independencia fue violenta"
        assert filter_text_for_band(text, "scholar") == text

    def test_board_filter_passes_adults(self):
        board = {"x": 1}
        assert filter_board_for_band(board, "scholar") is board


# =====================================================================
# CAPA ML OPCIONAL (graceful degradation sin transformers instalado)
# =====================================================================

from app.services.ml_safety import (  # noqa: E402 -- import tardío intencional en tests
    ml_detect_crisis_emotion,
    ml_detect_unsafe,
)


class TestMLSafety:
    def test_disabled_by_default(self):
        # Sin flag ni transformers, los modelos reportan available=False
        r = ml_detect_unsafe("texto cualquiera")
        assert r["available"] is False
        assert r["unsafe"] is False

    def test_crisis_disabled_by_default(self):
        r = ml_detect_crisis_emotion("me siento triste")
        assert r["available"] is False
        assert r["is_crisis_signal"] is False

    def test_empty_text_never_crashes(self):
        assert not ml_detect_unsafe("")["available"]
        assert not ml_detect_crisis_emotion(None)["available"]

    def test_safety_filter_still_works_without_ml(self):
        # La heurística es la capa base — funciona sin modelos
        assert contains_blocked_content("La tortura era común")
        assert not contains_blocked_content("Las fracciones son útiles")


# =====================================================================
# MOTOR ADAPTATIVO BKT
# =====================================================================


class TestBKT:
    params = BKT_PARAMS["scholar"]

    def test_correct_raises_mastery(self):
        p = 0.3
        new_p = bkt_update(p, correct=True, params=self.params)
        assert new_p > p

    def test_wrong_lowers_mastery(self):
        p = 0.7
        new_p = bkt_update(p, correct=False, params=self.params)
        assert new_p < p

    def test_mastery_grows_with_streak(self):
        p = 0.15
        for _ in range(8):
            p = bkt_update(p, correct=True, params=self.params)
        assert p > 0.9

    def test_recommend_level_up_after_mastery_streak(self):
        rec = recommend_next(0.9, streak=3)
        assert rec["difficulty_delta"] == 1

    def test_recommend_remediate_when_struggling(self):
        rec = recommend_next(0.2, streak=0)
        assert rec["action"] == "remediate"
        assert rec["difficulty_delta"] == -1

    def test_recommend_practice_in_middle(self):
        rec = recommend_next(0.6, streak=1)
        assert rec["action"] == "practice"
