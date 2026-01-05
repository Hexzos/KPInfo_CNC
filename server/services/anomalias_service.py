# server/services/anomalias_service.py
from typing import Any, Dict, List, Optional
from server.db import Database


class AnomaliasService:
    def __init__(self, db: Database):
        self.db = db

    def listar_anomalias(self, estado: Optional[str], q: Optional[str], incluir_archivados: bool) -> List[Dict[str, Any]]:
        where = []
        params: List[Any] = []

        # Archivado
        if estado == "archivado":
            if incluir_archivados:
                where.append("a.es_archivado = 1")
            else:
                where.append("1=0")
        else:
            where.append("a.es_archivado = 0")

        # Estado
        if estado and estado not in ("todos", "archivado"):
            where.append("a.estado = ?")
            params.append(estado)

        # Búsqueda simple (título, descripción, fecha, máquina)
        if q:
            like = f"%{q.strip()}%"
            where.append("(m.nombre LIKE ? OR a.descripcion LIKE ? OR a.fecha_registro LIKE ? OR a.titulo LIKE ?)")
            params.extend([like, like, like, like])

        sql = sql = f"""
            SELECT
            a.id,
            a.titulo,
            a.descripcion,
            a.fecha_registro,
            a.estado,
            t.nombre AS turno_nombre,
            m.nombre AS maquina_nombre,
            a.modificado_en,
            a.es_archivado
            FROM anomalia a
            JOIN turno t ON t.id = a.turno_id
            JOIN maquina m ON m.id = a.maquina_id
            {"WHERE " + " AND ".join(where) if where else ""}
            ORDER BY a.creado_en DESC, a.id DESC;
            """

        return self.db.query_all(sql, tuple(params))

    def crear_anomalia(self, dto: Dict[str, Any]) -> Dict[str, Any]:
        """
        Body esperado:
        - registro_turno_id (int)
        - turno_id (int)
        - maquina_id (int)
        - titulo (text)
        - descripcion (text)
        - fecha_registro (opcional; si no viene, usa default date('now'))
        """
        registro_turno_id = int(dto["registro_turno_id"])
        turno_id = int(dto["turno_id"])
        maquina_id = int(dto["maquina_id"])
        titulo = (dto.get("titulo") or "").strip()
        descripcion = (dto.get("descripcion") or "").strip()
        fecha_registro = (dto.get("fecha_registro") or "").strip()

        # MVP: siempre inicia en revisión (coherente con CHECK)
        estado = "en_revision"
        solucion = None
        es_archivado = 0

        if fecha_registro:
            self.db.execute(
                """
                INSERT INTO anomalia (
                  registro_turno_id,
                  turno_id,
                  fecha_registro,
                  maquina_id,
                  titulo,
                  descripcion,
                  estado,
                  solucion,
                  es_archivado,
                  modificado_en
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
                """,
                (
                    registro_turno_id,
                    turno_id,
                    fecha_registro,
                    maquina_id,
                    titulo,
                    descripcion,
                    estado,
                    solucion,
                    es_archivado,
                ),
            )
        else:
            # Si no viene, dejamos que actúe DEFAULT (date('now'))
            self.db.execute(
                """
                INSERT INTO anomalia (
                  registro_turno_id,
                  turno_id,
                  maquina_id,
                  titulo,
                  descripcion,
                  estado,
                  solucion,
                  es_archivado,
                  modificado_en
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL);
                """,
                (
                    registro_turno_id,
                    turno_id,
                    maquina_id,
                    titulo,
                    descripcion,
                    estado,
                    solucion,
                    es_archivado,
                ),
            )

        row = self.db.query_one("SELECT last_insert_rowid() AS id;")
        new_id = int(row["id"])
        return self.obtener_anomalia_detalle(new_id)

    def obtener_anomalia_detalle(self, anomalia_id: int) -> Optional[Dict[str, Any]]:
        return self.db.query_one(
            """
            SELECT
              a.id,
              a.titulo,
              a.descripcion,

              a.turno_id,
              t.nombre AS turno_nombre,

              a.fecha_registro,
              a.creado_en,

              a.maquina_id,
              m.nombre AS maquina_nombre,

              a.estado,
              a.solucion,

              a.es_archivado,
              a.archivado_en,

              a.modificado_en
            FROM anomalia a
            JOIN turno t ON t.id = a.turno_id
            JOIN maquina m ON m.id = a.maquina_id
            WHERE a.id = ?;
            """,
            (anomalia_id,),
        )

    def actualizar_anomalia_operador(self, anomalia_id: int, dto: Dict[str, Any]) -> Dict[str, Any]:
        row = self.db.query_one(
            """
            SELECT id, estado, es_archivado
            FROM anomalia
            WHERE id = ?;
            """,
            (anomalia_id,),
        )

        if not row:
            raise ValueError("NOT_FOUND")

        if int(row.get("es_archivado", 0)) == 1:
            raise ValueError("ARCHIVED")

        estado_actual = (row.get("estado") or "").strip()
        if estado_actual == "solucionado":
            raise ValueError("LOCKED")

        estado_nuevo = (dto.get("estado") or "").strip()
        if estado_nuevo not in ("en_revision", "solucionado"):
            raise ValueError("ESTADO_INVALIDO")

        solucion = dto.get("solucion")
        solucion = (str(solucion).strip() if solucion is not None else None)

        # Reglas coherentes con CHECK de la tabla
        if estado_nuevo == "solucionado":
            if not solucion or len(solucion) < 10:
                raise ValueError("SOLUCION_REQUERIDA")
        else:
            # en_revision => debe persistir NULL o vacío (guardamos NULL)
            solucion = None

        self.db.execute(
            """
            UPDATE anomalia
            SET estado = ?, solucion = ?, modificado_en = datetime('now')
            WHERE id = ?;
            """,
            (estado_nuevo, solucion, anomalia_id),
        )

        return self.obtener_anomalia_detalle(anomalia_id)

    def actualizar_anomalia_admin(self, anomalia_id: int, dto: Dict[str, Any]) -> Dict[str, Any]:
        """
        Admin puede:
        - Editar titulo y descripcion
        - Cambiar estado (en_revision/solucionado), incluyendo reversión
        - Editar solucion (si estado queda solucionado debe cumplir >=10)
        Restricción: si está archivada => ARCHIVED
        """
        row = self.db.query_one(
            """
            SELECT id, estado, es_archivado
            FROM anomalia
            WHERE id = ?;
            """,
            (anomalia_id,),
        )

        if not row:
            raise ValueError("NOT_FOUND")

        if int(row.get("es_archivado", 0)) == 1:
            raise ValueError("ARCHIVED")

        cur = self.obtener_anomalia_detalle(anomalia_id)
        if not cur:
            raise ValueError("NOT_FOUND")

        # Campos editables (si no vienen, se conservan)
        titulo = (dto.get("titulo") if dto.get("titulo") is not None else cur.get("titulo")) or ""
        descripcion = (dto.get("descripcion") if dto.get("descripcion") is not None else cur.get("descripcion")) or ""

        titulo = str(titulo).strip()
        descripcion = str(descripcion).strip()

        # ✅ Validaciones coherentes con CHECKs del schema
        if len(titulo) < 2:
            raise ValueError("TITULO_INVALIDO")
        if len(descripcion) < 10:
            raise ValueError("DESCRIPCION_INVALIDA")

        # Estado/solución
        estado_nuevo = (dto.get("estado") if dto.get("estado") is not None else cur.get("estado")) or ""
        estado_nuevo = str(estado_nuevo).strip()

        if estado_nuevo not in ("en_revision", "solucionado"):
            raise ValueError("ESTADO_INVALIDO")

        solucion_in = dto.get("solucion") if dto.get("solucion") is not None else cur.get("solucion")
        solucion = (str(solucion_in).strip() if solucion_in is not None else None)

        if estado_nuevo == "solucionado":
            if not solucion or len(solucion) < 10:
                raise ValueError("SOLUCION_REQUERIDA")
        else:
            # en_revision => solución debe quedar NULL para cumplir CHECK
            solucion = None

        # Persistencia
        self.db.execute(
            """
            UPDATE anomalia
            SET
              titulo = ?,
              descripcion = ?,
              estado = ?,
              solucion = ?,
              modificado_en = datetime('now')
            WHERE id = ?;
            """,
            (titulo, descripcion, estado_nuevo, solucion, anomalia_id),
        )

        return self.obtener_anomalia_detalle(anomalia_id)
