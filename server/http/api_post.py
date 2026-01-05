# server/http/api_post.py
import sqlite3

from server.config import CONFIG
from server.http.security import verify_pbkdf2_password
from server.services.catalogos_admin_service import CatalogosAdminService
from server.utils.http_utils import read_json, send_json, ok, err

from server.validators import (
    validate_registro_turno_iniciar,
    validate_pedido_crear,
    validate_pedido_actualizar_operador,
    validate_anomalia_crear,
    validate_anomalia_actualizar_operador,
)


class ApiPostMixin:
    def handle_api_post(self, parsed):
        # =========================
        # ADMIN: CATÁLOGOS (CRUD)
        # =========================
        if parsed.path in (
            "/api/admin/catalogos/create",
            "/api/admin/catalogos/update",
            "/api/admin/catalogos/delete",
        ):
            if not self._handle_admin_guard():
                return

            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            catalogo = (dto.get("catalogo") or "").strip().lower()
            svc = CatalogosAdminService(self.db)

            # create
            if parsed.path.endswith("/create"):
                nombre = (dto.get("nombre") or "").strip()
                if not catalogo or not nombre:
                    return send_json(self, 400, err("VALIDATION_ERROR", "Debe indicar catálogo y nombre."))

                try:
                    new_id = svc.crear(catalogo=catalogo, nombre=nombre)
                    return send_json(self, 201, ok({"id": new_id, "nombre": nombre}))
                except ValueError as ve:
                    code = str(ve)
                    if code == "CATALOGO_INVALIDO":
                        return send_json(self, 400, err("VALIDATION_ERROR", "Catálogo inválido."))
                    if code == "NOMBRE_INVALIDO":
                        return send_json(self, 400, err("VALIDATION_ERROR", "Nombre inválido."))
                    return send_json(self, 400, err("VALIDATION_ERROR", "Solicitud inválida."))
                except sqlite3.IntegrityError as ie:
                    msg = str(ie).lower()
                    if "unique" in msg:
                        return send_json(self, 409, err("DUPLICATE", "Ya existe un registro con ese nombre."))
                    return send_json(self, 409, err("CONSTRAINT", "No se pudo crear el registro por restricción."))
                except Exception:
                    return send_json(self, 500, err("DB_ERROR", "Error al crear registro del catálogo."))

            # update
            if parsed.path.endswith("/update"):
                try:
                    item_id = int(dto.get("id"))
                    if item_id <= 0:
                        raise ValueError()
                except Exception:
                    return send_json(self, 400, err("VALIDATION_ERROR", "ID inválido."))

                nombre = (dto.get("nombre") or "").strip()
                if not catalogo or not nombre:
                    return send_json(self, 400, err("VALIDATION_ERROR", "Debe indicar catálogo y nombre."))

                try:
                    svc.actualizar(catalogo=catalogo, item_id=item_id, nombre=nombre)
                    return send_json(self, 200, ok({"id": item_id, "nombre": nombre}))
                except ValueError as ve:
                    code = str(ve)
                    if code == "CATALOGO_INVALIDO":
                        return send_json(self, 400, err("VALIDATION_ERROR", "Catálogo inválido."))
                    if code == "NOMBRE_INVALIDO":
                        return send_json(self, 400, err("VALIDATION_ERROR", "Nombre inválido."))
                    if code == "NOT_FOUND":
                        return send_json(self, 404, err("NOT_FOUND", "Registro no encontrado."))
                    return send_json(self, 400, err("VALIDATION_ERROR", "Solicitud inválida."))
                except sqlite3.IntegrityError as ie:
                    msg = str(ie).lower()
                    if "unique" in msg:
                        return send_json(self, 409, err("DUPLICATE", "Ya existe un registro con ese nombre."))
                    return send_json(self, 409, err("CONSTRAINT", "No se pudo actualizar por restricción."))
                except Exception:
                    return send_json(self, 500, err("DB_ERROR", "Error al actualizar registro del catálogo."))

            # delete
            if parsed.path.endswith("/delete"):
                try:
                    item_id = int(dto.get("id"))
                    if item_id <= 0:
                        raise ValueError()
                except Exception:
                    return send_json(self, 400, err("VALIDATION_ERROR", "ID inválido."))

                if not catalogo:
                    return send_json(self, 400, err("VALIDATION_ERROR", "Debe indicar catálogo."))

                try:
                    svc.eliminar(catalogo=catalogo, item_id=item_id)
                    return send_json(self, 200, ok({"deleted": True, "id": item_id}))
                except ValueError as ve:
                    code = str(ve)
                    if code == "CATALOGO_INVALIDO":
                        return send_json(self, 400, err("VALIDATION_ERROR", "Catálogo inválido."))
                    if code == "NOT_FOUND":
                        return send_json(self, 404, err("NOT_FOUND", "Registro no encontrado."))
                    if code == "REFERENCIADO":
                        return send_json(self, 409, err("IN_USE", "No se puede eliminar: el registro está referenciado."))
                    return send_json(self, 400, err("VALIDATION_ERROR", "Solicitud inválida."))
                except sqlite3.IntegrityError:
                    return send_json(
                        self,
                        409,
                        err("IN_USE", "No se puede eliminar: el registro está en uso por otros datos (FK)."),
                    )
                except Exception:
                    return send_json(self, 500, err("DB_ERROR", "Error al eliminar registro del catálogo."))

        # =========================
        # EXTRAS - elevate (principal + alias compat)
        # =========================
        if parsed.path in ("/api/extras/elevate", "/api/admin/elevate"):
            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            extras_key = (dto.get("extras_key") or dto.get("key") or dto.get("admin_key") or "").strip()

            try:
                registro_turno_id = int(dto.get("registro_turno_id"))
                if registro_turno_id <= 0:
                    raise ValueError()
            except Exception:
                return send_json(self, 400, err("VALIDATION_ERROR", "registro_turno_id inválido."))

            if not extras_key:
                return send_json(self, 400, err("VALIDATION_ERROR", "Ingrese la clave de extras."))

            try:
                data = self.extras.elevate(registro_turno_id=registro_turno_id, extras_key=extras_key)
            except ValueError as ve:
                code = str(ve)
                if code == "RID_NOT_FOUND":
                    return send_json(self, 404, err("NOT_FOUND", "Registro de turno no encontrado."))
                if code == "EXTRAS_KEY_INVALID":
                    return send_json(self, 401, err("UNAUTHORIZED", "Clave incorrecta, intente nuevamente."))
                return send_json(self, 400, err("VALIDATION_ERROR", "Solicitud inválida."))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al activar modo extras."))

            return send_json(self, 200, ok({"token": data["token"]}))

        # =========================
        # ADMIN: purge archivados (requiere ADMIN + EXTRAS)
        # =========================
        if parsed.path in (
            "/api/admin/purge/pedidos/range",
            "/api/admin/purge/pedidos/all",
            "/api/admin/purge/anomalias/range",
            "/api/admin/purge/anomalias/all",
        ):
            if not self._handle_admin_guard():
                return
            rid_extras = self._handle_extras_guard()
            if rid_extras is None:
                return

            try:
                dto = read_json(self) if parsed.path.endswith("/range") else {}
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            try:
                if parsed.path.startswith("/api/admin/purge/pedidos"):
                    if parsed.path.endswith("/all"):
                        deleted = self.db.execute("DELETE FROM pedido WHERE es_archivado = 1;")
                        self._extras_audit(
                            rid_extras, "PURGE_PEDIDOS_ALL", "pedido", None, "Purga completa pedidos archivados."
                        )
                        return send_json(self, 200, ok({"deleted": deleted}))

                    desde = (dto.get("desde") or "").strip()
                    hasta = (dto.get("hasta") or "").strip()
                    if not desde or not hasta:
                        return send_json(self, 400, err("VALIDATION_ERROR", "Debe indicar desde y hasta."))
                    deleted = self.db.execute(
                        """
                        DELETE FROM pedido
                         WHERE es_archivado = 1
                           AND fecha_registro >= ?
                           AND fecha_registro <= ?;
                        """,
                        (desde, hasta),
                    )
                    self._extras_audit(
                        rid_extras, "PURGE_PEDIDOS_RANGE", "pedido", None, f"Rango: {desde} a {hasta}."
                    )
                    return send_json(self, 200, ok({"deleted": deleted}))

                if parsed.path.startswith("/api/admin/purge/anomalias"):
                    if parsed.path.endswith("/all"):
                        deleted = self.db.execute("DELETE FROM anomalia WHERE es_archivado = 1;")
                        self._extras_audit(
                            rid_extras, "PURGE_ANOMALIAS_ALL", "anomalia", None, "Purga completa anomalías archivadas."
                        )
                        return send_json(self, 200, ok({"deleted": deleted}))

                    desde = (dto.get("desde") or "").strip()
                    hasta = (dto.get("hasta") or "").strip()
                    if not desde or not hasta:
                        return send_json(self, 400, err("VALIDATION_ERROR", "Debe indicar desde y hasta."))
                    deleted = self.db.execute(
                        """
                        DELETE FROM anomalia
                         WHERE es_archivado = 1
                           AND fecha_registro >= ?
                           AND fecha_registro <= ?;
                        """,
                        (desde, hasta),
                    )
                    self._extras_audit(
                        rid_extras, "PURGE_ANOMALIAS_RANGE", "anomalia", None, f"Rango: {desde} a {hasta}."
                    )
                    return send_json(self, 200, ok({"deleted": deleted}))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al ejecutar purga."))

        # =========================
        # ADMIN: rotar clave extras (requiere ADMIN)
        # =========================
        if parsed.path == "/api/admin/extras-key/rotate":
            if not self._handle_admin_guard():
                return

            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            current = (dto.get("extras_key_current") or "").strip()
            new = (dto.get("extras_key_new") or "").strip()

            if not current or not new:
                return send_json(self, 400, err("VALIDATION_ERROR", "Campos incompletos."))

            if current != CONFIG.extra_key:
                return send_json(self, 401, err("UNAUTHORIZED", "Clave actual incorrecta."))

            if len(new) < 8:
                return send_json(self, 400, err("VALIDATION_ERROR", "La nueva clave debe tener al menos 8 caracteres."))

            CONFIG.extra_key = new

            rid_extras = self._get_extras_rid_if_any()
            if rid_extras:
                self._extras_audit(rid_extras, "ROTATE_EXTRAS_KEY", "settings", None, "Rotación de extras_key (runtime).")

            return send_json(self, 200, ok({"rotated": True}))

        # =========================
        # PEDIDOS - archivar/restaurar (solo extras)
        # =========================
        if parsed.path.startswith("/api/pedidos/") and (
            parsed.path.endswith("/archivar") or parsed.path.endswith("/restaurar")
        ):
            tail = parsed.path.split("/api/pedidos/", 1)[1].strip("/")
            parts = tail.split("/")
            if len(parts) != 2:
                return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))

            try:
                pedido_id = self._parse_pos_int(parts[0])
            except ValueError:
                return send_json(self, 400, err("VALIDATION_ERROR", "ID de pedido inválido."))

            action = parts[1]
            rid = self._handle_extras_guard()
            if rid is None:
                return

            try:
                row = self.db.query_one("SELECT id FROM pedido WHERE id = ?;", (pedido_id,))
                if not row:
                    return send_json(self, 404, err("NOT_FOUND", "Pedido no encontrado."))

                if action == "archivar":
                    self.db.execute(
                        """
                        UPDATE pedido
                           SET es_archivado = 1,
                               archivado_en = datetime('now'),
                               modificado_en = datetime('now')
                         WHERE id = ?;
                        """,
                        (pedido_id,),
                    )
                    self._extras_audit(rid, "ARCHIVAR_PEDIDO", "pedido", pedido_id, "Pedido archivado (extras).")
                    return send_json(self, 200, ok({"id": pedido_id, "es_archivado": 1}))

                if action == "restaurar":
                    self.db.execute(
                        """
                        UPDATE pedido
                           SET es_archivado = 0,
                               archivado_en = NULL,
                               modificado_en = datetime('now')
                         WHERE id = ?;
                        """,
                        (pedido_id,),
                    )
                    self._extras_audit(rid, "RESTAURAR_PEDIDO", "pedido", pedido_id, "Pedido restaurado (extras).")
                    return send_json(self, 200, ok({"id": pedido_id, "es_archivado": 0}))

                return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al actualizar estado de archivado del pedido."))

        # =========================
        # ANOMALÍAS - archivar/restaurar (solo extras)
        # =========================
        if parsed.path.startswith("/api/anomalias/") and (
            parsed.path.endswith("/archivar") or parsed.path.endswith("/restaurar")
        ):
            tail = parsed.path.split("/api/anomalias/", 1)[1].strip("/")
            parts = tail.split("/")
            if len(parts) != 2:
                return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))

            try:
                anomalia_id = self._parse_pos_int(parts[0])
            except ValueError:
                return send_json(self, 400, err("VALIDATION_ERROR", "ID de anomalía inválido."))

            action = parts[1]
            rid = self._handle_extras_guard()
            if rid is None:
                return

            try:
                row = self.db.query_one("SELECT id FROM anomalia WHERE id = ?;", (anomalia_id,))
                if not row:
                    return send_json(self, 404, err("NOT_FOUND", "Anomalía no encontrada."))

                if action == "archivar":
                    self.db.execute(
                        """
                        UPDATE anomalia
                           SET es_archivado = 1,
                               archivado_en = datetime('now'),
                               modificado_en = datetime('now')
                         WHERE id = ?;
                        """,
                        (anomalia_id,),
                    )
                    self._extras_audit(rid, "ARCHIVAR_ANOMALIA", "anomalia", anomalia_id, "Anomalía archivada (extras).")
                    return send_json(self, 200, ok({"id": anomalia_id, "es_archivado": 1}))

                if action == "restaurar":
                    self.db.execute(
                        """
                        UPDATE anomalia
                           SET es_archivado = 0,
                               archivado_en = NULL,
                               modificado_en = datetime('now')
                         WHERE id = ?;
                        """,
                        (anomalia_id,),
                    )
                    self._extras_audit(
                        rid, "RESTAURAR_ANOMALIA", "anomalia", anomalia_id, "Anomalía restaurada (extras)."
                    )
                    return send_json(self, 200, ok({"id": anomalia_id, "es_archivado": 0}))

                return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al actualizar estado de archivado de la anomalía."))

        # =========================
        # SESIÓN: iniciar registro turno (operador/admin)
        # =========================
        if parsed.path == "/api/registro-turno/iniciar":
            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            valid, fields = validate_registro_turno_iniciar(dto)
            if not valid:
                return send_json(self, 400, err("VALIDATION_ERROR", "Hay campos inválidos.", fields))

            admin_username = (dto.get("admin_username") or "").strip()
            admin_password = dto.get("admin_password") or ""
            admin_key = (dto.get("admin_key") or "").strip()

            admin_attempt = bool(admin_username or admin_password or admin_key)

            if admin_attempt:
                if not admin_username or not admin_password or not admin_key:
                    return send_json(
                        self, 400, err("VALIDATION_ERROR", "Para acceso administrador, ingrese usuario, contraseña y admin key.")
                    )

                if admin_key != CONFIG.admin_key:
                    return send_json(self, 401, err("UNAUTHORIZED", "Admin key incorrecta."))

                if admin_username != CONFIG.admin_username:
                    return send_json(self, 401, err("UNAUTHORIZED", "Usuario administrador incorrecto."))

                if not verify_pbkdf2_password(admin_password, CONFIG.admin_password_hash):
                    return send_json(self, 401, err("UNAUTHORIZED", "Contraseña incorrecta."))

                rol = "admin"
            else:
                # ✅ CAMBIO MÍNIMO: bloquear credenciales reservadas en modo operador
                op_nombre = (dto.get("operador_nombre") or "").strip().lower()
                op_apellido = (dto.get("operador_apellido") or "").strip().lower()

                # Regla solicitada: no permitir "admin cnc" como operador
                if op_nombre == "admin" and op_apellido == "cnc":
                    return send_json(
                        self,
                        400,
                        err("VALIDATION_ERROR", "Credenciales reservadas. Use el acceso administrador."),
                    )

                rol = "operador"

            try:
                data = self.sesion.iniciar_registro_turno(dto["operador_nombre"], dto["operador_apellido"])
                data["rol"] = rol
                if rol == "admin":
                    data["admin_key"] = CONFIG.admin_key
                return send_json(self, 201, ok(data))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al crear registro de turno."))

        # =========================
        # PEDIDOS: crear
        # =========================
        if parsed.path == "/api/pedidos":
            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            valid, fields = validate_pedido_crear(dto)
            if not valid:
                return send_json(self, 400, err("VALIDATION_ERROR", "Hay campos inválidos.", fields))

            try:
                data = self.pedidos.crear_pedido(dto)
                return send_json(self, 201, ok(data))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al crear pedido."))

        # =========================
        # PEDIDOS: actualizar (extras/operador)
        # =========================
        if parsed.path.startswith("/api/pedidos/") and parsed.path.endswith("/actualizar"):
            tail = parsed.path.split("/api/pedidos/", 1)[1].strip("/")
            parts = tail.split("/")

            if len(parts) != 2 or parts[1] != "actualizar":
                return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))

            try:
                pedido_id = self._parse_pos_int(parts[0])
            except ValueError:
                return send_json(self, 400, err("VALIDATION_ERROR", "ID de pedido inválido."))

            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            rid_extras = self._get_extras_rid_if_any()
            is_extras = rid_extras is not None

            try:
                if is_extras and hasattr(self.pedidos, "actualizar_pedido_admin"):
                    data = self.pedidos.actualizar_pedido_admin(pedido_id, dto)  # type: ignore
                    self._extras_audit(
                        rid_extras,
                        "ACTUALIZAR_PEDIDO_EXTRAS",
                        "pedido",
                        pedido_id,
                        "Actualización extras (edición completa/reapertura).",
                    )
                else:
                    valid, fields = validate_pedido_actualizar_operador(dto)
                    if not valid:
                        return send_json(self, 400, err("VALIDATION_ERROR", "Hay campos inválidos.", fields))
                    data = self.pedidos.actualizar_pedido_operador(pedido_id, dto)

                return send_json(self, 200, ok(data))

            except ValueError as ve:
                code = str(ve)
                if code == "NOT_FOUND":
                    return send_json(self, 404, err("NOT_FOUND", "Pedido no encontrado."))
                if code == "ARCHIVED":
                    return send_json(self, 400, err("VALIDATION_ERROR", "No se puede modificar un pedido archivado."))
                if code == "LOCKED":
                    return send_json(
                        self, 400, err("VALIDATION_ERROR", "El pedido ya fue cerrado (completado/cancelado) y no admite modificaciones.")
                    )
                if code == "PLANCHAS_INVALID":
                    return send_json(self, 400, err("VALIDATION_ERROR", "Planchas asignadas inválidas."))
                if code == "ULTIMA_OUT_OF_RANGE":
                    return send_json(self, 400, err("VALIDATION_ERROR", "Última plancha fuera de rango."))
                if code == "CORTES_NEG":
                    return send_json(self, 400, err("VALIDATION_ERROR", "Cortes totales inválidos."))
                if code == "ESTADO_INVALIDO":
                    return send_json(self, 400, err("VALIDATION_ERROR", "Estado inválido."))
                if code == "NO_COMPLETABLE":
                    return send_json(self, 400, err("VALIDATION_ERROR", "No se puede completar si faltan planchas por trabajar."))
                return send_json(self, 400, err("VALIDATION_ERROR", "Solicitud inválida."))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al actualizar el pedido."))

        # =========================
        # ANOMALÍAS: crear
        # =========================
        if parsed.path == "/api/anomalias":
            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            valid, fields = validate_anomalia_crear(dto)
            if not valid:
                return send_json(self, 400, err("VALIDATION_ERROR", "Hay campos inválidos.", fields))

            try:
                data = self.anomalias.crear_anomalia(dto)
                return send_json(self, 201, ok(data))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al crear anomalía."))

        # =========================
        # ANOMALÍAS: actualizar (extras/operador)
        # =========================
        if parsed.path.startswith("/api/anomalias/") and parsed.path.endswith("/actualizar"):
            tail = parsed.path.split("/api/anomalias/", 1)[1].strip("/")
            parts = tail.split("/")

            if len(parts) != 2 or parts[1] != "actualizar":
                return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))

            try:
                anomalia_id = self._parse_pos_int(parts[0])
            except ValueError:
                return send_json(self, 400, err("VALIDATION_ERROR", "ID de anomalía inválido."))

            try:
                dto = read_json(self)
            except ValueError as ex:
                return send_json(self, 400, err("VALIDATION_ERROR", str(ex)))

            rid_extras = self._get_extras_rid_if_any()
            is_extras = rid_extras is not None

            try:
                if is_extras and hasattr(self.anomalias, "actualizar_anomalia_admin"):
                    data = self.anomalias.actualizar_anomalia_admin(anomalia_id, dto)  # type: ignore
                    self._extras_audit(
                        rid_extras,
                        "ACTUALIZAR_ANOMALIA_EXTRAS",
                        "anomalia",
                        anomalia_id,
                        "Actualización extras (incluye reversión/edición completa).",
                    )
                else:
                    valid, fields = validate_anomalia_actualizar_operador(dto)
                    if not valid:
                        return send_json(self, 400, err("VALIDATION_ERROR", "Hay campos inválidos.", fields))
                    data = self.anomalias.actualizar_anomalia_operador(anomalia_id, dto)

                return send_json(self, 200, ok(data))

            except ValueError as ve:
                code = str(ve)
                if code == "NOT_FOUND":
                    return send_json(self, 404, err("NOT_FOUND", "Anomalía no encontrada."))
                if code == "ARCHIVED":
                    return send_json(self, 400, err("VALIDATION_ERROR", "No se puede modificar una anomalía archivada."))
                if code == "LOCKED":
                    return send_json(
                        self, 400, err("VALIDATION_ERROR", "La anomalía ya fue cerrada (solucionada) y no admite modificaciones.")
                    )
                if code == "ESTADO_INVALIDO":
                    return send_json(self, 400, err("VALIDATION_ERROR", "Estado inválido."))
                if code == "SOLUCION_REQUERIDA":
                    return send_json(self, 400, err("VALIDATION_ERROR", "La solución es obligatoria (mínimo 10 caracteres)."))
                return send_json(self, 400, err("VALIDATION_ERROR", "Solicitud inválida."))
            except Exception:
                return send_json(self, 500, err("DB_ERROR", "Error al actualizar la anomalía."))

        return send_json(self, 404, err("NOT_FOUND", "Endpoint no encontrado."))
