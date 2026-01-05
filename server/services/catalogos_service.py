# server/services/catalogos_service.py
from typing import Any, Dict, List
from ..db import Database


class CatalogoService:
    def __init__(self, db: Database):
        self.db = db

    def get_catalogos(self) -> Dict[str, Any]:
        turnos = self.db.query_all("SELECT id, nombre FROM turno ORDER BY id;")
        maquinas = self.db.query_all("SELECT id, nombre FROM maquina ORDER BY id;")
        tipos = self.db.query_all("SELECT id, nombre FROM tipo_plancha ORDER BY id;")

        # ✅ catálogo de variaciones (tabla variacion_material)
        variaciones = self.db.query_all("SELECT id, nombre FROM variacion_material ORDER BY id;")

        # ✅ mapeo material -> variaciones (tabla puente)
        rows = self.db.query_all(
            """
            SELECT
              tpv.tipo_plancha_id AS tipo_plancha_id,
              vm.id               AS variacion_id,
              vm.nombre           AS variacion_nombre
            FROM tipo_plancha_variacion tpv
            JOIN variacion_material vm
              ON vm.id = tpv.variacion_material_id
            ORDER BY tpv.tipo_plancha_id ASC, vm.nombre ASC;
            """
        )

        tipo_plancha_variaciones: Dict[int, List[Dict[str, Any]]] = {}
        for r in rows or []:
            tp_id = int(r["tipo_plancha_id"])
            tipo_plancha_variaciones.setdefault(tp_id, []).append(
                {"id": int(r["variacion_id"]), "nombre": r["variacion_nombre"]}
            )

        return {
            "turnos": turnos,
            "maquinas": maquinas,
            "tipos_plancha": tipos,
            "variaciones": variaciones,
            "tipo_plancha_variaciones": tipo_plancha_variaciones,
        }
