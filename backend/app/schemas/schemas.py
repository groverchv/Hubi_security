from typing import Literal

from pydantic import BaseModel, Field


class CardSchema(BaseModel):
    id: str = Field(..., description="Identificador único de la carta (ej. 'card_1')")
    concept_name: str = Field(..., description="Nombre del concepto clave extraído")
    content: str = Field(..., description="Descripción breve o explicación del concepto")
    points_multiplier: Literal["1x", "2x", "3x"] = Field(
        default="1x", description="Multiplicador de puntos según dificultad del concepto"
    )


class AnswerSpec(BaseModel):
    """Especificación de respuesta polimórfica por arquetipo de nodo."""

    type: Literal["match", "solve", "numeric", "sequence"] = Field(
        default="match",
        description="Arquetipo: match (concepto↔carta) o solve (problema→respuesta)",
    )
    value: str | None = Field(default=None, description="Valor esperado de la respuesta")
    tolerance: float | None = Field(
        default=None, description="Tolerancia numérica para verificación local"
    )
    latex: str | None = Field(default=None, description="Representación LaTeX del enunciado")
    topic: str | None = Field(default=None, description="Subtema pedagógico (ej. 'fracciones')")
    misconceptions: dict | None = Field(
        default=None, description="Mapa distractor→razón del error típico"
    )
    hint: str | None = Field(default=None, description="Pista contextual del problema")
    explanation: str | None = Field(default=None, description="Explicación de la solución")


class NodeSchema(BaseModel):
    id: str = Field(..., description="Identificador único del nodo en el tablero (ej. 'node_1')")
    correct_card_id: str = Field(..., description="ID de la carta que encaja en este nodo")
    description: str = Field(
        ..., description="Pista o rol del nodo que orienta al estudiante sin revelar el nombre"
    )
    question: str | None = Field(
        default=None, description="Pregunta pedagógica interna formulada para este nodo"
    )
    question_latex: str | None = Field(
        default=None, description="Enunciado en LaTeX para render KaTeX"
    )
    answer_spec: AnswerSpec | None = Field(
        default=None, description="Spec de respuesta para arquetipos no-match (matemática, física)"
    )


class GameBoardResponse(BaseModel):
    id_tablero: str = Field(..., description="UUID o identificador único del tablero de juego")
    title: str = Field(..., description="Título sintético y motivador del tema de estudio")
    nodes: list[NodeSchema] = Field(
        default_factory=list, description="Lista de nodos receptores del diagrama"
    )
    cards: list[CardSchema] = Field(
        default_factory=list, description="Mano de cartas que el jugador debe posicionar"
    )
    domain: str | None = Field(
        default=None, description="Dominio pedagógico detectado (matematica, fisica, ...)"
    )
    age_band: str | None = Field(
        default=None, description="Banda de edad para la que se generó el tablero"
    )
    board_version: int = Field(default=1, description="Versión del formato de tablero")


class GenerateBoardRequest(BaseModel):
    text: str = Field(
        ..., min_length=15, description="Texto denso de estudio o fragmento de PDF a procesar"
    )
    level: int = Field(default=1, ge=1, le=20, description="Nivel de dificultad (1 a 20)")
    question_count: int = Field(
        default=3, ge=1, le=30, description="Número de preguntas/nodos a generar"
    )
    difficulty: str = Field(
        default="facil",
        description="Dificultad pedagógica: facil, seminormal, normal, semidificil, dificil",
    )
    excluded_concepts: list[str] | None = Field(
        default_factory=list,
        description="Lista de conceptos y respuestas ya evaluados en niveles previos que NO deben repetirse",
    )
    age_band: str | None = Field(
        default=None,
        description="Banda de edad del jugador (sprout|explorer|adventurer|challenger|scholar|pro)",
    )
    domain: str | None = Field(
        default=None, description="Dominio forzado; si es None se detecta automáticamente del texto"
    )
    gender: str | None = Field(
        default=None,
        description="Género declarado del jugador para lenguaje inclusivo en los enunciados",
    )
