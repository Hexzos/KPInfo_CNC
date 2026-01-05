from typing import Any, Dict, Tuple


def validate_registro_turno_iniciar(dto: Dict[str, Any]) -> Tuple[bool, Dict[str, str]]:
    fields: Dict[str, str] = {}

    nombre = (dto.get("operador_nombre") or "").strip()
    apellido = (dto.get("operador_apellido") or "").strip()

    if len(nombre) < 2:
        fields["operador_nombre"] = "Nombre debe tener al menos 2 caracteres."
    if len(apellido) < 2:
        fields["operador_apellido"] = "Apellido debe tener al menos 2 caracteres."

    return (len(fields) == 0, fields)


def validate_pedido_crear(dto: Dict[str, Any]) -> Tuple[bool, Dict[str, str]]:
    fields: Dict[str, str] = {}

    def is_pos_int(x):
        return isinstance(x, int) and x > 0

    registro_turno_id = dto.get("registro_turno_id")
    turno_id = dto.get("turno_id")
    maquina_asignada = (dto.get("maquina_asignada") or "").strip()
    codigo_producto = (dto.get("codigo_producto") or "").strip()
    descripcion_producto = (dto.get("descripcion_producto") or "").strip()
    tipo_plancha_id = dto.get("tipo_plancha_id")
    espesor_mm = dto.get("espesor_mm")
    medida_plancha = (dto.get("medida_plancha") or "").strip()
    variacion_material = (dto.get("variacion_material") or "").strip()
    planchas_asignadas = dto.get("planchas_asignadas")

    if not is_pos_int(registro_turno_id):
        fields["registro_turno_id"] = "registro_turno_id inválido."
    if not is_pos_int(turno_id):
        fields["turno_id"] = "Seleccione un turno."
    if maquina_asignada not in ("BOF", "Rover", "Ambas"):
        fields["maquina_asignada"] = "Seleccione máquina asignada."
    if len(codigo_producto) < 1:
        fields["codigo_producto"] = "Campo obligatorio."
    if len(descripcion_producto) < 10:
        fields["descripcion_producto"] = "Mínimo 10 caracteres."
    if not is_pos_int(tipo_plancha_id):
        fields["tipo_plancha_id"] = "Seleccione tipo de plancha."
    try:
        esp = float(espesor_mm)
        if esp <= 0:
            raise ValueError()
    except Exception:
        fields["espesor_mm"] = "Debe ser mayor a 0."
    if len(medida_plancha) < 3:
        fields["medida_plancha"] = "Ingrese medida válida."
    if len(variacion_material) < 1:
        fields["variacion_material"] = "Seleccione variación."
    if not is_pos_int(planchas_asignadas):
        fields["planchas_asignadas"] = "Debe ser entero mayor que 0."

    return (len(fields) == 0, fields)


def validate_pedido_actualizar_operador(dto: Dict[str, Any]) -> Tuple[bool, Dict[str, str]]:
    """
    Validación de forma (no de negocio con planchas_asignadas).
    Eso se valida en el service.
    """
    fields: Dict[str, str] = {}

    # Solo permitidos:
    allowed = {"ultima_plancha_trabajada", "cortes_totales", "estado"}
    extra = [k for k in dto.keys() if k not in allowed]
    if extra:
        fields["_"] = f"Campos no permitidos: {', '.join(extra)}"

    # ultima_plancha_trabajada
    try:
        ultima = int(dto.get("ultima_plancha_trabajada"))
        if ultima < 0:
            fields["ultima_plancha_trabajada"] = "Debe ser >= 0."
    except Exception:
        fields["ultima_plancha_trabajada"] = "Debe ser un entero."

    # cortes_totales
    try:
        cortes = int(dto.get("cortes_totales"))
        if cortes < 0:
            fields["cortes_totales"] = "Debe ser >= 0."
    except Exception:
        fields["cortes_totales"] = "Debe ser un entero."

    # estado
    estado = (dto.get("estado") or "").strip()
    if estado not in ("en_proceso", "completado", "cancelado"):
        fields["estado"] = "Estado inválido."

    return (len(fields) == 0, fields)


# =========================
# ✅ ANOMALÍAS (NUEVO)
# =========================

def validate_anomalia_crear(dto: Dict[str, Any]) -> Tuple[bool, Dict[str, str]]:
    """
    Crear anomalía:
    - registro_turno_id (int>0)
    - turno_id (int>0)
    - maquina_id (int>0)
    - titulo (>=3)
    - descripcion (>=10)
    - fecha_registro (string no vacía; ideal ISO YYYY-MM-DD)
    """
    fields: Dict[str, str] = {}

    def is_pos_int(x):
        return isinstance(x, int) and x > 0

    registro_turno_id = dto.get("registro_turno_id")
    turno_id = dto.get("turno_id")
    maquina_id = dto.get("maquina_id")
    titulo = (dto.get("titulo") or "").strip()
    descripcion = (dto.get("descripcion") or "").strip()
    fecha_registro = (dto.get("fecha_registro") or "").strip()

    if not is_pos_int(registro_turno_id):
        fields["registro_turno_id"] = "registro_turno_id inválido."
    if not is_pos_int(turno_id):
        fields["turno_id"] = "Seleccione un turno."
    if not is_pos_int(maquina_id):
        fields["maquina_id"] = "Seleccione máquina asignada."
    if len(titulo) < 3:
        fields["titulo"] = "Nombre del problema debe tener al menos 3 caracteres."
    if len(descripcion) < 10:
        fields["descripcion"] = "Descripción debe tener al menos 10 caracteres."
    if len(fecha_registro) < 8:
        fields["fecha_registro"] = "Fecha inválida."

    return (len(fields) == 0, fields)


def validate_anomalia_actualizar_operador(dto: Dict[str, Any]) -> Tuple[bool, Dict[str, str]]:
    """
    Operador puede:
    - Cambiar estado: en_revision | solucionado
    - Agregar solución (obligatoria si estado=solucionado, >=10)
    Reglas coherentes con CHECK:
    - en_revision => solucion debe quedar vacía/null
    """
    fields: Dict[str, str] = {}

    # Solo permitidos:
    allowed = {"estado", "solucion"}
    extra = [k for k in dto.keys() if k not in allowed]
    if extra:
        fields["_"] = f"Campos no permitidos: {', '.join(extra)}"

    estado = (dto.get("estado") or "").strip()
    if estado not in ("en_revision", "solucionado"):
        fields["estado"] = "Estado inválido."

    solucion = dto.get("solucion")
    if solucion is not None:
        solucion = str(solucion).strip()
    else:
        solucion = None

    if estado == "solucionado":
        if not solucion or len(solucion) < 10:
            fields["solucion"] = "La solución es obligatoria (mínimo 10 caracteres)."

    if estado == "en_revision":
        if solucion and len(solucion) > 0:
            fields["solucion"] = "En revisión no debe registrar solución."

    return (len(fields) == 0, fields)
