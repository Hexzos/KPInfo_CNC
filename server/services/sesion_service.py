from typing import Any, Dict
from ..db import Database

class SesionService:
    def __init__(self, db: Database):
        self.db = db

    def iniciar_registro_turno(self, operador_nombre: str, operador_apellido: str) -> Dict[str, Any]:
        # Inserta contexto de sesión (sin turno). La BD aplica CHECKs.
        rid = self.db.execute(
            """
            INSERT INTO registro_turno (operador_nombre, operador_apellido)
            VALUES (?, ?);
            """,
            (operador_nombre.strip(), operador_apellido.strip()),
        )

        row = self.db.query_one(
            """
            SELECT id AS registro_turno_id, fecha, creado_en
            FROM registro_turno
            WHERE id = ?;
            """,
            (rid,),
        )

        return row or {"registro_turno_id": rid}
