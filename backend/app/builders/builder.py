import uuid

from app.schemas.schemas import AnswerSpec, CardSchema, GameBoardResponse, NodeSchema


class GameBoardBuilder:
    """
    Patrón Builder para ensamblar paso a paso el objeto GameBoardResponse,
    sus Nodes receptores y su baraja de Cards correspondientes.
    """

    def __init__(self, title: str = "Tablero de Aprendizaje Zen", board_id: str | None = None):
        self._board_id: str = board_id or str(uuid.uuid4())
        self._title: str = title
        self._cards: list[CardSchema] = []
        self._nodes: list[NodeSchema] = []
        self._domain: str | None = None
        self._age_band: str | None = None
        self._board_version: int = 1

    def set_title(self, title: str) -> "GameBoardBuilder":
        if title and title.strip():
            self._title = title.strip()
        return self

    def set_meta(
        self, domain: str | None = None, age_band: str | None = None, board_version: int = 2
    ) -> "GameBoardBuilder":
        self._domain = domain
        self._age_band = age_band
        self._board_version = board_version
        return self

    def add_card(
        self, card_id: str, concept_name: str, content: str, points_multiplier: str = "1x"
    ) -> "GameBoardBuilder":
        card = CardSchema(
            id=card_id,
            concept_name=concept_name,
            content=content,
            points_multiplier=points_multiplier,
        )
        self._cards.append(card)
        return self

    def add_node(
        self,
        node_id: str,
        correct_card_id: str,
        description: str,
        question: str | None = None,
        question_latex: str | None = None,
        answer_spec: AnswerSpec | None = None,
    ) -> "GameBoardBuilder":
        node = NodeSchema(
            id=node_id,
            correct_card_id=correct_card_id,
            description=description,
            question=question,
            question_latex=question_latex,
            answer_spec=answer_spec,
        )
        self._nodes.append(node)
        return self

    def build(self) -> GameBoardResponse:
        """Construye y valida el objeto GameBoardResponse final."""
        return GameBoardResponse(
            id_tablero=self._board_id,
            title=self._title,
            nodes=self._nodes,
            cards=self._cards,
            domain=self._domain,
            age_band=self._age_band,
            board_version=self._board_version,
        )
