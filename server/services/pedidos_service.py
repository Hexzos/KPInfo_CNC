# server/services/pedidos_service.py
from typing import Any, Dict, List, Optional
from ..db import Database


class PedidosService:
    def __init__(self, db: Database):
        self.db = db

    # -----------------------
    # Crear
    # -----------------------
    def crear_pedido(self, dto: Dict[str, Any]) -> Dict[str, Any]:
        rid = self.db.execute(
            """
            INSERT INTO pedido (
              registro_turno_id, turno_id,
              codigo_producto, descripcion_producto,
              maquina_asignada,
              tipo_plancha_id, espesor_mm,
              medida_plancha, variacion_material,
              planchas_asignadas,
              estado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_proceso');
            """,
            (
                dto["registro_turno_id"],
                dto["turno_id"],
                dto["codigo_producto"].strip(),
                dto["descripcion_producto"].strip(),
                dto["maquina_asignada"],
                dto["tipo_plancha_id"],
                dto["espesor_mm"],
                dto["medida_plancha"].strip(),
                dto["variacion_material"].strip(),
                dto["planchas_asignadas"],
            ),
        )

        row = self.db.query_one(
            """
            SELECT
              p.id,
              p.codigo_producto,
              p.descripcion_producto,
              p.fecha_registro,
              p.estado,
              p.maquina_asignada,
              t.nombre AS turno_nombre
            FROM pedido p
            JOIN turno t ON t.id = p.turno_id
            WHERE p.id = ?;
            """,
            (rid,),
        )
        return row or {"id": rid}

    # -----------------------
    # Listar
    # -----------------------
    def listar_pedidos(self, estado: Optional[str], q: Optional[str], incluir_archivados: bool) -> List[Dict[str, Any]]:
        where = []
        params: List[Any] = []

        # Archivado
        if estado == "archivado":
            if incluir_archivados:
                where.append("p.es_archivado = 1")
            else:
                where.append("1=0")
        else:
            where.append("p.es_archivado = 0")

        # Estado
        if estado and estado not in ("general", "archivado"):
            where.append("p.estado = ?")
            params.append(estado)

        # Búsqueda
        if q:
            like = f"%{q.strip()}%"
            where.append("(p.codigo_producto LIKE ? OR p.descripcion_producto LIKE ? OR p.fecha_registro LIKE ?)")
            params.extend([like, like, like])

        sql = f"""
        SELECT
          p.id,
          p.codigo_producto,
          p.descripcion_producto,
          p.fecha_registro,
          p.estado,
          p.maquina_asignada,
          t.nombre AS turno_nombre
        FROM pedido p
        JOIN turno t ON t.id = p.turno_id
        {"WHERE " + " AND ".join(where) if where else ""}
        ORDER BY p.creado_en DESC;
        """
        return self.db.query_all(sql, tuple(params))

    # -----------------------
    # Detalle
    # -----------------------
    def obtener_pedido_detalle(self, pedido_id: int) -> Optional[Dict[str, Any]]:
        return self.db.query_one(
            """
            SELECT
              p.id,
              p.codigo_producto,
              p.descripcion_producto,

              p.turno_id,
              t.nombre AS turno_nombre,
              p.fecha_registro,
              p.creado_en,
              p.modificado_en,

              p.maquina_asignada,

              p.tipo_plancha_id,
              tp.nombre AS tipo_plancha_nombre,
              p.espesor_mm,
              p.medida_plancha,
              p.variacion_material,

              p.planchas_asignadas,
              p.ultima_plancha_trabajada,
              p.cortes_totales,

              p.estado,
              p.es_archivado,
              p.archivado_en
            FROM pedido p
            JOIN turno t ON t.id = p.turno_id
            JOIN tipo_plancha tp ON tp.id = p.tipo_plancha_id
            WHERE p.id = ?;
            """,
            (pedido_id,),
        )

    # -----------------------
    # Actualizar (operador)
    # -----------------------
    def actualizar_pedido_operador(self, pedido_id: int, dto: Dict[str, Any]) -> Dict[str, Any]:
        row = self.db.query_one(
            """
            SELECT
              id,
              registro_turno_id,
              estado,
              es_archivado,
              planchas_asignadas,
              ultima_plancha_trabajada,
              cortes_totales,
              turno_id,
              fecha_registro
            FROM pedido
            WHERE id = ?;
            """,
            (pedido_id,),
        )

        if not row:
            raise ValueError("NOT_FOUND")

        if int(row.get("es_archivado", 0)) == 1:
            raise ValueError("ARCHIVED")

        estado_actual = (row.get("estado") or "").strip()
        if estado_actual in ("completado", "cancelado"):
            raise ValueError("LOCKED")

        planchas_asignadas = int(row.get("planchas_asignadas", 0))
        ultima_actual = int(row.get("ultima_plancha_trabajada") or 0)

        try:
            ultima_nueva = int(dto.get("ultima_plancha_trabajada"))
        except Exception:
            raise ValueError("ULTIMA_OUT_OF_RANGE")

        try:
            cortes = int(dto.get("cortes_totales"))
        except Exception:
            raise ValueError("CORTES_NEG")

        if ultima_nueva < 0 or ultima_nueva > planchas_asignadas:
            raise ValueError("ULTIMA_OUT_OF_RANGE")

        if cortes < 0:
            raise ValueError("CORTES_NEG")

        estado_nuevo = (dto.get("estado") or "").strip()
        if estado_nuevo not in ("en_proceso", "completado", "cancelado"):
            raise ValueError("ESTADO_INVALIDO")

        if estado_nuevo == "completado" and ultima_nueva < planchas_asignadas:
            raise ValueError("NO_COMPLETABLE")

        delta_planchas = max(0, ultima_nueva - ultima_actual)

        self.db.execute(
            """
            UPDATE pedido
            SET
              ultima_plancha_trabajada = ?,
              cortes_totales = ?,
              estado = ?,
              modificado_en = datetime('now')
            WHERE id = ?;
            """,
            (ultima_nueva, cortes, estado_nuevo, pedido_id),
        )

        if delta_planchas > 0:
            try:
                self.db.execute(
                    """
                    INSERT INTO pedido_planchas_log (
                      pedido_id,
                      registro_turno_id,
                      turno_id,
                      fecha_registro,
                      delta_planchas,
                      ultima_antes,
                      ultima_nueva
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        pedido_id,
                        int(row.get("registro_turno_id") or 0),
                        int(row.get("turno_id") or 0),
                        (row.get("fecha_registro") or ""),
                        int(delta_planchas),
                        int(ultima_actual),
                        int(ultima_nueva),
                    ),
                )
            except Exception:
                pass

        return self.obtener_pedido_detalle(pedido_id) or {"id": pedido_id}

    # -----------------------
    # ✅ Actualizar (admin)
    #
    # Admin puede editar:
    # - planchas_asignadas
    # - ultima_plancha_trabajada
    # - cortes_totales
    # - estado (incluso si estaba completado/cancelado; permite "reabrir")
    #
    # Mantiene:
    # - ARCHIVED bloquea
    # - completar requiere ultima == planchas_asignadas (admin puede ajustar planchas para calzar)
    # - log delta: solo incrementos (si baja ultima, no loguea)
    # -----------------------
    def actualizar_pedido_admin(self, pedido_id: int, dto: Dict[str, Any]) -> Dict[str, Any]:
        row = self.db.query_one(
            """
            SELECT
              id,
              registro_turno_id,
              estado,
              es_archivado,
              planchas_asignadas,
              ultima_plancha_trabajada,
              cortes_totales,
              turno_id,
              fecha_registro
            FROM pedido
            WHERE id = ?;
            """,
            (pedido_id,),
        )

        if not row:
            raise ValueError("NOT_FOUND")

        if int(row.get("es_archivado", 0)) == 1:
            raise ValueError("ARCHIVED")

        planchas_actual = int(row.get("planchas_asignadas", 0))
        ultima_actual = int(row.get("ultima_plancha_trabajada") or 0)
        cortes_actual = int(row.get("cortes_totales") or 0)
        estado_actual = (row.get("estado") or "en_proceso").strip()

        # planchas_asignadas (si no viene, mantener)
        if dto.get("planchas_asignadas") is None:
            planchas_nuevas = planchas_actual
        else:
            try:
                planchas_nuevas = int(dto.get("planchas_asignadas"))
            except Exception:
                raise ValueError("PLANCHAS_INVALID")

        # ultima_plancha_trabajada (si no viene, mantener)
        if dto.get("ultima_plancha_trabajada") is None:
            ultima_nueva = ultima_actual
        else:
            try:
                ultima_nueva = int(dto.get("ultima_plancha_trabajada"))
            except Exception:
                raise ValueError("ULTIMA_OUT_OF_RANGE")

        # cortes_totales (si no viene, mantener)
        if dto.get("cortes_totales") is None:
            cortes = cortes_actual
        else:
            try:
                cortes = int(dto.get("cortes_totales"))
            except Exception:
                raise ValueError("CORTES_NEG")

        # Validaciones
        if planchas_nuevas <= 0:
            raise ValueError("PLANCHAS_INVALID")

        if ultima_nueva < 0 or ultima_nueva > planchas_nuevas:
            raise ValueError("ULTIMA_OUT_OF_RANGE")

        if cortes < 0:
            raise ValueError("CORTES_NEG")

        # estado (si no viene, mantener)
        estado_nuevo = dto.get("estado") if dto.get("estado") is not None else estado_actual
        estado_nuevo = str(estado_nuevo).strip() if estado_nuevo else "en_proceso"
        if estado_nuevo not in ("en_proceso", "completado", "cancelado"):
            raise ValueError("ESTADO_INVALIDO")

        # Regla dominio para completar
        if estado_nuevo == "completado" and ultima_nueva < planchas_nuevas:
            raise ValueError("NO_COMPLETABLE")

        # Delta (solo incrementos)
        delta_planchas = max(0, ultima_nueva - ultima_actual)

        # Persistir
        self.db.execute(
            """
            UPDATE pedido
            SET
              planchas_asignadas = ?,
              ultima_plancha_trabajada = ?,
              cortes_totales = ?,
              estado = ?,
              modificado_en = datetime('now')
            WHERE id = ?;
            """,
            (planchas_nuevas, ultima_nueva, cortes, estado_nuevo, pedido_id),
        )

        # Log (solo si delta > 0)
        if delta_planchas > 0:
            try:
                self.db.execute(
                    """
                    INSERT INTO pedido_planchas_log (
                      pedido_id,
                      registro_turno_id,
                      turno_id,
                      fecha_registro,
                      delta_planchas,
                      ultima_antes,
                      ultima_nueva
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        pedido_id,
                        int(row.get("registro_turno_id") or 0),
                        int(row.get("turno_id") or 0),
                        (row.get("fecha_registro") or ""),
                        int(delta_planchas),
                        int(ultima_actual),
                        int(ultima_nueva),
                    ),
                )
            except Exception:
                pass

        return self.obtener_pedido_detalle(pedido_id) or {"id": pedido_id}
