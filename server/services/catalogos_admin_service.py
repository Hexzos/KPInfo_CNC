# server/services/catalogos_admin_service.py
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from server.db import Database


@dataclass(frozen=True)
class CatalogSpec:
    table: str
    label: str
    # ref_checks: (name, sql) -> sql devuelve una fila con COUNT(*) AS c
    ref_checks: Tuple[Tuple[str, str], ...]


class CatalogosAdminService:
    """
    CRUD admin de catálogos (capa 2):
    - No modifica schema (no agrega "activo").
    - Para UI: entregamos "activo" = 1 (siempre).
    - Eliminación: solo si NO hay referencias (según FK reales + tabla puente).
    - Gestión adicional: asignación de variaciones por material mediante tabla puente
      tipo_plancha_variacion (capa 2 de relación).
    """

    def __init__(self, db: Database):
        self.db = db

        # Referencias reales (según schema.sql + tabla puente)
        self._specs: Dict[str, CatalogSpec] = {
            "turnos": CatalogSpec(
                table="turno",
                label="Turnos",
                ref_checks=(
                    ("pedido", "SELECT COUNT(*) AS c FROM pedido WHERE turno_id = ?;"),
                    ("anomalia", "SELECT COUNT(*) AS c FROM anomalia WHERE turno_id = ?;"),
                    ("pedido_planchas_log", "SELECT COUNT(*) AS c FROM pedido_planchas_log WHERE turno_id = ?;"),
                ),
            ),
            "maquinas": CatalogSpec(
                table="maquina",
                label="Máquinas",
                ref_checks=(
                    ("anomalia", "SELECT COUNT(*) AS c FROM anomalia WHERE maquina_id = ?;"),
                ),
            ),
            "tipos_plancha": CatalogSpec(
                table="tipo_plancha",
                label="Tipos de plancha",
                ref_checks=(
                    ("pedido", "SELECT COUNT(*) AS c FROM pedido WHERE tipo_plancha_id = ?;"),
                    # ✅ tabla puente: no permitir eliminar material si tiene variaciones asignadas
                    ("tipo_plancha_variacion", "SELECT COUNT(*) AS c FROM tipo_plancha_variacion WHERE tipo_plancha_id = ?;"),
                ),
            ),
            # Nota: pedido.variacion_material es TEXT, no FK. Este catálogo es "sugerido".
            "variaciones": CatalogSpec(
                table="variacion_material",
                label="Variaciones",
                ref_checks=(
                    # ✅ tabla puente: no permitir eliminar variación si está asignada a algún material
                    ("tipo_plancha_variacion", "SELECT COUNT(*) AS c FROM tipo_plancha_variacion WHERE variacion_material_id = ?;"),
                ),
            ),
        }

    # -----------------------
    # helpers
    # -----------------------
    def _get_spec(self, key: str) -> CatalogSpec:
        spec = self._specs.get((key or "").strip())
        if not spec:
            raise ValueError("CATALOGO_INVALIDO")
        return spec

    def _clean_nombre(self, nombre: Any) -> str:
        n = (str(nombre or "")).strip()
        if len(n) < 2:
            raise ValueError("NOMBRE_INVALIDO")
        return n

    def _parse_id(self, id_value: Any) -> int:
        try:
            n = int(id_value)
            if n <= 0:
                raise ValueError()
            return n
        except Exception:
            raise ValueError("ID_INVALIDO")

    def _exists(self, table: str, item_id: int) -> bool:
        row = self.db.query_one(f"SELECT id FROM {table} WHERE id = ?;", (item_id,))
        return bool(row)

    # -----------------------
    # CRUD catálogos
    # -----------------------
    def listar(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Devuelve todos los catálogos en una sola llamada.
        Formato UI:
          { turnos:[...], maquinas:[...], tipos_plancha:[...], variaciones:[...] }
        """
        out: Dict[str, List[Dict[str, Any]]] = {}
        for key, spec in self._specs.items():
            rows = self.db.query_all(f"SELECT id, nombre FROM {spec.table} ORDER BY nombre ASC;")
            out[key] = [{"id": r["id"], "nombre": r["nombre"], "activo": 1} for r in (rows or [])]
        return out

    def crear(self, catalogo: str, nombre: Any) -> Dict[str, Any]:
        spec = self._get_spec(catalogo)
        n = self._clean_nombre(nombre)

        try:
            self.db.execute(f"INSERT INTO {spec.table} (nombre) VALUES (?);", (n,))
        except sqlite3.IntegrityError:
            # Unique/constraint
            raise ValueError("NOMBRE_DUPLICADO")
        except Exception:
            raise

        row = self.db.query_one(f"SELECT id, nombre FROM {spec.table} WHERE nombre = ?;", (n,))
        return {"id": row["id"], "nombre": row["nombre"], "activo": 1}

    def actualizar(self, catalogo: str, item_id: Any, nombre: Any) -> Dict[str, Any]:
        spec = self._get_spec(catalogo)
        item_id_n = self._parse_id(item_id)
        n = self._clean_nombre(nombre)

        exists = self.db.query_one(f"SELECT id FROM {spec.table} WHERE id = ?;", (item_id_n,))
        if not exists:
            raise ValueError("NOT_FOUND")

        try:
            self.db.execute(f"UPDATE {spec.table} SET nombre = ? WHERE id = ?;", (n, item_id_n))
        except sqlite3.IntegrityError:
            raise ValueError("NOMBRE_DUPLICADO")
        except Exception:
            raise

        row = self.db.query_one(f"SELECT id, nombre FROM {spec.table} WHERE id = ?;", (item_id_n,))
        return {"id": row["id"], "nombre": row["nombre"], "activo": 1}

    def eliminar(self, catalogo: str, item_id: Any) -> Dict[str, Any]:
        spec = self._get_spec(catalogo)
        item_id_n = self._parse_id(item_id)

        exists = self.db.query_one(f"SELECT id FROM {spec.table} WHERE id = ?;", (item_id_n,))
        if not exists:
            raise ValueError("NOT_FOUND")

        # Validar referencias
        for _, sql in spec.ref_checks:
            c_row = self.db.query_one(sql, (item_id_n,))
            c = int((c_row or {}).get("c", 0))
            if c > 0:
                raise ValueError("REFERENCIADO")

        self.db.execute(f"DELETE FROM {spec.table} WHERE id = ?;", (item_id_n,))
        return {"deleted": 1, "id": item_id_n}

    # -----------------------
    # Variaciones asignadas por material (tabla puente)
    # -----------------------
    def listar_variaciones_asignadas(self, tipo_plancha_id: Any) -> List[Dict[str, Any]]:
        tp_id = self._parse_id(tipo_plancha_id)

        if not self._exists("tipo_plancha", tp_id):
            raise ValueError("MATERIAL_NOT_FOUND")

        rows = self.db.query_all(
            """
            SELECT
              vm.id,
              vm.nombre
            FROM tipo_plancha_variacion tpv
            JOIN variacion_material vm
              ON vm.id = tpv.variacion_material_id
            WHERE tpv.tipo_plancha_id = ?
            ORDER BY vm.nombre ASC;
            """,
            (tp_id,),
        )
        return [{"id": r["id"], "nombre": r["nombre"], "activo": 1} for r in (rows or [])]

    def asignar_variacion(self, tipo_plancha_id: Any, variacion_id: Any) -> Dict[str, Any]:
        tp_id = self._parse_id(tipo_plancha_id)
        v_id = self._parse_id(variacion_id)

        if not self._exists("tipo_plancha", tp_id):
            raise ValueError("MATERIAL_NOT_FOUND")
        if not self._exists("variacion_material", v_id):
            raise ValueError("VARIACION_NOT_FOUND")

        # evitar "assigned true" silencioso si ya existe
        exists = self.db.query_one(
            """
            SELECT 1 AS ok
              FROM tipo_plancha_variacion
             WHERE tipo_plancha_id = ?
               AND variacion_material_id = ?
             LIMIT 1;
            """,
            (tp_id, v_id),
        )
        if exists:
            raise ValueError("ASIGNACION_EXISTE")

        self.db.execute(
            """
            INSERT INTO tipo_plancha_variacion (tipo_plancha_id, variacion_material_id)
            VALUES (?, ?);
            """,
            (tp_id, v_id),
        )
        return {"assigned": True, "tipo_plancha_id": tp_id, "variacion_id": v_id}

    def desasignar_variacion(self, tipo_plancha_id: Any, variacion_id: Any) -> Dict[str, Any]:
        tp_id = self._parse_id(tipo_plancha_id)
        v_id = self._parse_id(variacion_id)

        if not self._exists("tipo_plancha", tp_id):
            raise ValueError("MATERIAL_NOT_FOUND")
        if not self._exists("variacion_material", v_id):
            raise ValueError("VARIACION_NOT_FOUND")

        exists = self.db.query_one(
            """
            SELECT 1 AS ok
              FROM tipo_plancha_variacion
             WHERE tipo_plancha_id = ?
               AND variacion_material_id = ?
             LIMIT 1;
            """,
            (tp_id, v_id),
        )
        if not exists:
            raise ValueError("ASIGNACION_NO_EXISTE")

        self.db.execute(
            """
            DELETE FROM tipo_plancha_variacion
             WHERE tipo_plancha_id = ?
               AND variacion_material_id = ?;
            """,
            (tp_id, v_id),
        )
        return {"unassigned": True, "tipo_plancha_id": tp_id, "variacion_id": v_id}
