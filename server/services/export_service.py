# server/services/export_service.py
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from server.db import Database


def _safe_iso_date(s: str) -> Optional[str]:
    """
    Valida formato YYYY-MM-DD (sin ser demasiado estricto) y retorna el mismo string si es válido.
    """
    s = (s or "").strip()
    if not s:
        return None
    try:
        datetime.fromisoformat(s)
        return s[:10]
    except Exception:
        return None


def _date_range_where(desde: Optional[str], hasta: Optional[str], field: str) -> Tuple[str, List[Any]]:
    """
    Retorna (sql_where_fragment, params) para filtrar por rango inclusivo.
    """
    where = []
    params: List[Any] = []

    if desde:
        where.append(f"{field} >= ?")
        params.append(desde)
    if hasta:
        where.append(f"{field} <= ?")
        params.append(hasta)

    if not where:
        return ("", [])
    return (" AND " + " AND ".join(where), params)


class ExportService:
    def __init__(self, db: Database):
        self.db = db

    # -----------------------
    # Pedidos -> CSV
    # -----------------------
    def export_pedidos_csv(self, desde: Optional[str], hasta: Optional[str]) -> Tuple[bytes, str]:
        """
        Exporta pedidos a CSV (bytes utf-8) y retorna (content_bytes, filename_sugerido)

        ✅ Ajuste aplicado SOLO a pedidos (según lo acordado):
        - Se DESCARTA la métrica "planchas_turno_rango" (no se exporta / no se calcula).
        - Se mantiene "modificado_en" si existe en la tabla.
        - CSV amigable para Excel (ES/CL): ';' + UTF-8 con BOM + CRLF.
        """
        d = _safe_iso_date(desde or "")
        h = _safe_iso_date(hasta or "")

        if d and h and d > h:
            raise ValueError("DATE_RANGE_INVALID")

        where_fragment, params = _date_range_where(d, h, "p.fecha_registro")

        rows = self.db.query_all(
            f"""
            SELECT
              p.id,
              p.fecha_registro,
              t.nombre AS turno,
              p.codigo_producto,
              p.descripcion_producto,
              p.maquina_asignada,
              tp.nombre AS tipo_plancha,
              p.espesor_mm,
              p.medida_plancha,
              p.variacion_material,
              p.planchas_asignadas,
              p.ultima_plancha_trabajada,
              p.cortes_totales,
              p.estado,
              p.modificado_en
            FROM pedido p
            JOIN turno t ON t.id = p.turno_id
            JOIN tipo_plancha tp ON tp.id = p.tipo_plancha_id
            WHERE p.es_archivado = 0
            {where_fragment}
            ORDER BY p.creado_en DESC, p.id DESC;
            """,
            tuple(params),
        )

        headers = [
            "id",
            "fecha_registro",
            "turno",
            "codigo_producto",
            "descripcion_producto",
            "maquina_asignada",
            "tipo_plancha",
            "espesor_mm",
            "medida_plancha",
            "variacion_material",
            "planchas_asignadas",
            "ultima_plancha_trabajada",
            "cortes_totales",
            "estado",
            "modificado_en",
        ]

        content = self._to_csv_bytes(rows, headers)
        fname = self._filename("pedidos", d, h)
        return content, fname

    # -----------------------
    # Anomalías -> CSV
    # (SIN CAMBIOS)
    # -----------------------
    def export_anomalias_csv(self, desde: Optional[str], hasta: Optional[str]) -> Tuple[bytes, str]:
        """
        Exporta anomalías a CSV (bytes utf-8) y retorna (content_bytes, filename_sugerido)
        """
        d = _safe_iso_date(desde or "")
        h = _safe_iso_date(hasta or "")

        if d and h and d > h:
            raise ValueError("DATE_RANGE_INVALID")

        where_fragment, params = _date_range_where(d, h, "a.fecha_registro")

        rows = self.db.query_all(
            f"""
            SELECT
              a.id,
              a.fecha_registro,
              t.nombre AS turno,
              m.nombre AS maquina,
              a.titulo,
              a.descripcion,
              a.estado,
              a.solucion,
              a.modificado_en
            FROM anomalia a
            JOIN turno t ON t.id = a.turno_id
            JOIN maquina m ON m.id = a.maquina_id
            WHERE a.es_archivado = 0
            {where_fragment}
            ORDER BY a.creado_en DESC, a.id DESC;
            """,
            tuple(params),
        )

        headers = [
            "id",
            "fecha_registro",
            "turno",
            "maquina",
            "titulo",
            "descripcion",
            "estado",
            "solucion",
            "modificado_en",
        ]

        content = self._to_csv_bytes(rows, headers)
        fname = self._filename("anomalias", d, h)
        return content, fname

    # -----------------------
    # Helpers
    # -----------------------
    def _to_csv_bytes(self, rows: List[Dict[str, Any]], headers: List[str]) -> bytes:
        """
        CSV amigable para Excel (ES/CL):
        - delimitador ';'
        - UTF-8 con BOM (utf-8-sig)
        - CRLF para líneas
        """
        buf = io.StringIO(newline="")
        w = csv.writer(
            buf,
            delimiter=";",
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\r\n",
        )

        w.writerow(headers)
        for r in rows:
            w.writerow([self._cell(r.get(h)) for h in headers])

        return buf.getvalue().encode("utf-8-sig")

    def _cell(self, v: Any) -> str:
        if v is None:
            return ""
        if isinstance(v, str):
            # Normalizamos saltos de línea dentro de celdas
            return v.replace("\r\n", "\n").replace("\r", "\n")
        return str(v)

    def _filename(self, base: str, desde: Optional[str], hasta: Optional[str]) -> str:
        """
        Nombre sugerido: base_YYYY-MM-DD_YYYY-MM-DD.csv (si no hay rango, usa 'all')
        """
        if desde or hasta:
            d = desde or "inicio"
            h = hasta or "hoy"
            return f"{base}_{d}_{h}.csv"
        return f"{base}_all.csv"
