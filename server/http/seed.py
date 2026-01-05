# server/http/seed.py
from server.db import Database


def seed_catalogos(db: Database) -> None:
    """
    Seed idempotente:
    - Inserta catálogos base si faltan.
    - Inserta variaciones (variacion_material) como catálogo sugerido.
    - Inserta asignaciones por material en tipo_plancha_variacion (tabla puente).
    """

    # -------------------------
    # 1) Catálogos base
    # -------------------------
    turnos = ["Normal", "Día", "Tarde", "Noche"]
    maquinas = ["BOF", "Rover"]
    tipos_plancha = ["terciado", "mdf", "melamina", "durolac", "hpl", "acrilico"]

    db.execute_many(
        "INSERT OR IGNORE INTO turno (nombre) VALUES (?);",
        [(x,) for x in turnos],
    )
    db.execute_many(
        "INSERT OR IGNORE INTO maquina (nombre) VALUES (?);",
        [(x,) for x in maquinas],
    )
    db.execute_many(
        "INSERT OR IGNORE INTO tipo_plancha (nombre) VALUES (?);",
        [(x,) for x in tipos_plancha],
    )

    # -------------------------
    # 2) Reglas de variaciones por material (según levantamiento)
    # -------------------------
    # Terciado y MDF: “formalita / color”
    variaciones_terciado_mdf = [
        "no",
        "rojo",
        "verde",
        "azul capri",
        "roble",
        "amarillo",
        "naranjo",
        "gris",
        "blanco",
        "negro",
        "berenjena",
        "otro",
    ]

    # Melamina y Durolac: “textura”
    variaciones_melamina_durolac = [
        "cocobolo",
        "roble",
        "peral",
        "cerezo",
        "chocolate",
        "blanco",
        "negro",
        "rojo",
        "gris",
        "otro",
    ]

    # HPL: “color”
    variaciones_hpl = [
        "blanco",
        "negro",
        "otro",
    ]

    # Acrílico: “tipo”
    variaciones_acrilico = [
        "transparente",
        "otro",
    ]

    reglas = {
        "terciado": variaciones_terciado_mdf,
        "mdf": variaciones_terciado_mdf,
        "melamina": variaciones_melamina_durolac,
        "durolac": variaciones_melamina_durolac,
        "hpl": variaciones_hpl,
        "acrilico": variaciones_acrilico,
    }

    # -------------------------
    # 3) Sembrar catálogo global de variaciones (unión)
    # -------------------------
    # Nota: "otro" es único, se comparte entre materiales.
    all_variaciones = []
    seen = set()
    for arr in reglas.values():
        for v in arr:
            vv = (v or "").strip().lower()
            if not vv:
                continue
            if vv not in seen:
                seen.add(vv)
                all_variaciones.append(vv)

    db.execute_many(
        "INSERT OR IGNORE INTO variacion_material (nombre) VALUES (?);",
        [(v,) for v in all_variaciones],
    )

    # -------------------------
    # 4) Sembrar asignaciones en tabla puente tipo_plancha_variacion
    # -------------------------
    # Helpers para mapear nombre -> id
    def _id_por_nombre(table: str, nombre: str) -> int:
        row = db.query_one(f"SELECT id FROM {table} WHERE lower(nombre) = lower(?);", (nombre,))
        return int(row["id"]) if row else 0

    def _ids_variaciones(nombres):
        if not nombres:
            return []
        # Normalizar a lower
        wanted = [(x or "").strip().lower() for x in nombres if (x or "").strip()]
        if not wanted:
            return []
        # Traer ids de una sola vez
        placeholders = ",".join(["?"] * len(wanted))
        rows = db.query_all(
            f"SELECT id, nombre FROM variacion_material WHERE lower(nombre) IN ({placeholders});",
            tuple(wanted),
        )
        # Devolver ids (si falta alguna, no rompe; solo no la asigna)
        return [int(r["id"]) for r in (rows or [])]

    inserts = []
    for mat_nombre, vars_list in reglas.items():
        tp_id = _id_por_nombre("tipo_plancha", mat_nombre)
        if not tp_id:
            continue

        v_ids = _ids_variaciones(vars_list)
        for v_id in v_ids:
            inserts.append((tp_id, v_id))

    if inserts:
        db.execute_many(
            """
            INSERT OR IGNORE INTO tipo_plancha_variacion (tipo_plancha_id, variacion_material_id)
            VALUES (?, ?);
            """,
            inserts,
        )
