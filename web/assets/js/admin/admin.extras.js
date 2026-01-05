// web/assets/js/admin/admin.extras.js
(function () {
  window.KP = window.KP || {};
  window.KP.adminExtras = window.KP.adminExtras || {};

  const { setMsg } = window.KP.adminState || {};

  // =========================
  // Endpoints (backend)
  // =========================
  const API_ADMIN_STATUS = "/api/admin/status"; // opcional

  const API_PURGE_PEDIDOS_RANGE = "/api/admin/purge/pedidos/range";
  const API_PURGE_PEDIDOS_ALL = "/api/admin/purge/pedidos/all";
  const API_PURGE_ANOMALIAS_RANGE = "/api/admin/purge/anomalias/range";
  const API_PURGE_ANOMALIAS_ALL = "/api/admin/purge/anomalias/all";

  const API_ROTATE_EXTRAS_KEY = "/api/admin/extras-key/rotate";

  // Auto-elevate extras al entrar como admin
  const API_EXTRAS_ELEVATE = "/api/extras/elevate";

  // =========================
  // Estado / sesión
  // =========================
  function isAdminSession() {
    const s = window.KP?.Session?.getRegistroTurno?.();
    const k = window.KP?.Session?.getAdminKey?.();
    return !!(s?.registro_turno_id && s?.rol === "admin" && k);
  }

  function isExtrasActive() {
    return !!window.KP?.Session?.getExtrasToken?.();
  }

  function ensureAdminOrRedirect() {
    if (window.KPINIT?.requireAdminPage) return window.KPINIT.requireAdminPage();

    if (!isAdminSession()) {
      window.KP?.Session?.clear?.();
      window.location.href = "/index.html";
      return false;
    }
    return true;
  }

  // =========================
  // UI: Badge + mensaje superior
  // =========================
  function paintEstadoBadge() {
    const badge = document.getElementById("adminBadge");
    if (!badge) return;

    const adminOk = isAdminSession();
    const extrasOk = isExtrasActive();

    badge.textContent = adminOk ? "ADMIN" : "—";

    badge.classList.toggle("estado-pill--on", adminOk);
    badge.classList.toggle("estado-pill--warn", adminOk && !extrasOk);
  }

  function paintTopMessage() {
    const el = document.getElementById("adminTopMsg");
    if (!el) return;

    const s = window.KP?.Session?.getRegistroTurno?.();
    const extrasOk = isExtrasActive();

    if (s?.rol === "admin") {
      el.hidden = false;
      el.textContent = extrasOk
        ? "Administrador activo. Opciones Extras: activas."
        : "Administrador activo. Activando Opciones Extras…";
      el.classList.remove("msg--err");
      el.classList.toggle("msg--ok", extrasOk);
      return;
    }

    el.textContent = "";
    el.classList.remove("msg--ok", "msg--err");
    el.hidden = true;
  }

  async function loadStatus() {
    paintEstadoBadge();
    paintTopMessage();

    const s = window.KP?.Session?.getRegistroTurno?.();
    const extrasOk = isExtrasActive();

    if (s?.rol === "admin") {
      setMsg &&
        setMsg(
          "adminMsg",
          `Sesión válida. Rol: admin. ${
            extrasOk ? "Extras: activo." : "Extras: inactivo (acciones críticas bloqueadas)."
          }`,
          extrasOk ? "ok" : ""
        );
    } else {
      setMsg && setMsg("adminMsg", "Acceso inválido: esta vista requiere rol admin.", "err");
    }

    // Endpoint status (si existe) solo para informar
    try {
      const payload = await window.KP.API.fetchJSON(API_ADMIN_STATUS, { method: "GET" });
      const data = payload?.data || {};
      if (typeof data.extras_active === "boolean") {
        setMsg &&
          setMsg(
            "adminMsg",
            `Sesión válida. Rol: admin. Extras: ${data.extras_active ? "activo" : "inactivo"}.`,
            data.extras_active ? "ok" : ""
          );
      }
    } catch {
      // silencioso
    }
  }

  // =========================
  // Auto-elevate: Admin => Extras por defecto
  // =========================
  async function ensureExtrasForAdmin() {
    if (!isAdminSession()) return;
    if (isExtrasActive()) return;

    const s = window.KP?.Session?.getRegistroTurno?.();
    const k = window.KP?.Session?.getAdminKey?.();
    if (!s?.registro_turno_id || !k) return;

    paintEstadoBadge();
    paintTopMessage();

    try {
      const payload = await window.KP.API.fetchJSON(API_EXTRAS_ELEVATE, {
        method: "POST",
        body: JSON.stringify({
          registro_turno_id: s.registro_turno_id,
          extras_key: k,
        }),
      });

      const token = payload?.data?.token;
      if (token) {
        window.KP.Session.setExtrasToken(token);
        window.KP.Session.setExtrasEnabled(true);
      }

      paintEstadoBadge();
      paintTopMessage();
      setMsg && setMsg("adminMsg", "Sesión válida. Rol: admin. Extras: activo.", "ok");
    } catch (e) {
      paintEstadoBadge();
      const msg = e?.message || "No fue posible activar Opciones Extras automáticamente.";
      setMsg &&
        setMsg(
          "adminMsg",
          `Sesión válida. Rol: admin. Extras: inactivo (acciones críticas bloqueadas). ${msg}`,
          ""
        );

      const top = document.getElementById("adminTopMsg");
      if (top) {
        top.hidden = false;
        top.textContent = "Administrador activo. Opciones Extras: inactivas (active manualmente con el engranaje).";
        top.classList.remove("msg--ok");
      }
    }
  }

  // =========================
  // Purga (requiere extras token)
  // =========================
  function ensureExtrasOrWarn(targetMsgId) {
    if (isExtrasActive()) return true;
    setMsg && setMsg(targetMsgId, "Acción bloqueada: requiere Opciones Extras activas.", "err");
    return false;
  }

  async function doPurgePedidosRange() {
    if (!ensureExtrasOrWarn("purgePedidosMsg")) return;

    const desde = (document.getElementById("purgePedidosDesde")?.value || "").trim();
    const hasta = (document.getElementById("purgePedidosHasta")?.value || "").trim();

    setMsg && setMsg("purgePedidosMsg", "", "");
    try {
      const payload = await window.KP.API.fetchJSON(API_PURGE_PEDIDOS_RANGE, {
        method: "POST",
        body: JSON.stringify({ desde, hasta }),
      });
      const n = payload?.data?.deleted ?? null;
      setMsg &&
        setMsg(
          "purgePedidosMsg",
          `Eliminación por rango completada.${n !== null ? " Eliminados: " + n : ""}`,
          "ok"
        );
      setMsg && setMsg("purgeMsg", "Purga ejecutada correctamente.", "ok");
    } catch (e) {
      setMsg && setMsg("purgePedidosMsg", e?.message || "No fue posible ejecutar la purga.", "err");
    }
  }

  async function doPurgePedidosAll() {
    if (!ensureExtrasOrWarn("purgePedidosMsg")) return;

    setMsg && setMsg("purgePedidosMsg", "", "");
    try {
      const payload = await window.KP.API.fetchJSON(API_PURGE_PEDIDOS_ALL, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const n = payload?.data?.deleted ?? null;
      setMsg &&
        setMsg(
          "purgePedidosMsg",
          `Purga completa (pedidos) completada.${n !== null ? " Eliminados: " + n : ""}`,
          "ok"
        );
      setMsg && setMsg("purgeMsg", "Purga ejecutada correctamente.", "ok");
    } catch (e) {
      setMsg && setMsg("purgePedidosMsg", e?.message || "No fue posible ejecutar la purga.", "err");
    }
  }

  async function doPurgeAnomaliasRange() {
    if (!ensureExtrasOrWarn("purgeAnomaliasMsg")) return;

    const desde = (document.getElementById("purgeAnomaliasDesde")?.value || "").trim();
    const hasta = (document.getElementById("purgeAnomaliasHasta")?.value || "").trim();

    setMsg && setMsg("purgeAnomaliasMsg", "", "");
    try {
      const payload = await window.KP.API.fetchJSON(API_PURGE_ANOMALIAS_RANGE, {
        method: "POST",
        body: JSON.stringify({ desde, hasta }),
      });
      const n = payload?.data?.deleted ?? null;
      setMsg &&
        setMsg(
          "purgeAnomaliasMsg",
          `Eliminación por rango completada.${n !== null ? " Eliminados: " + n : ""}`,
          "ok"
        );
      setMsg && setMsg("purgeMsg", "Purga ejecutada correctamente.", "ok");
    } catch (e) {
      setMsg && setMsg("purgeAnomaliasMsg", e?.message || "No fue posible ejecutar la purga.", "err");
    }
  }

  async function doPurgeAnomaliasAll() {
    if (!ensureExtrasOrWarn("purgeAnomaliasMsg")) return;

    setMsg && setMsg("purgeAnomaliasMsg", "", "");
    try {
      const payload = await window.KP.API.fetchJSON(API_PURGE_ANOMALIAS_ALL, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const n = payload?.data?.deleted ?? null;
      setMsg &&
        setMsg(
          "purgeAnomaliasMsg",
          `Purga completa (anomalías) completada.${n !== null ? " Eliminados: " + n : ""}`,
          "ok"
        );
      setMsg && setMsg("purgeMsg", "Purga ejecutada correctamente.", "ok");
    } catch (e) {
      setMsg && setMsg("purgeAnomaliasMsg", e?.message || "No fue posible ejecutar la purga.", "err");
    }
  }

  // =========================
  // Rotar clave (ADMIN)
  // =========================
  async function doRotateExtrasKey() {
    setMsg && setMsg("rotateExtrasKeyMsg", "", "");

    const current = (document.getElementById("extrasKeyCurrent")?.value || "").trim();
    const next = (document.getElementById("extrasKeyNewModal")?.value || "").trim();
    const confirm = (document.getElementById("extrasKeyNewConfirm")?.value || "").trim();

    if (!current || !next || !confirm) {
      setMsg && setMsg("rotateExtrasKeyMsg", "Complete los campos obligatorios.", "err");
      return;
    }
    if (next.length < 8) {
      setMsg && setMsg("rotateExtrasKeyMsg", "La nueva clave debe tener al menos 8 caracteres.", "err");
      return;
    }
    if (next !== confirm) {
      setMsg && setMsg("rotateExtrasKeyMsg", "Confirmación no coincide con la nueva clave.", "err");
      return;
    }

    try {
      await window.KP.API.fetchJSON(API_ROTATE_EXTRAS_KEY, {
        method: "POST",
        body: JSON.stringify({ extras_key_current: current, extras_key_new: next }),
      });

      setMsg && setMsg("rotateExtrasKeyMsg", "Clave actualizada correctamente.", "ok");
      setMsg && setMsg("extrasKeyMsg", "Clave actualizada.", "ok");

      // limpiar inputs
      const a = document.getElementById("extrasKeyCurrent");
      const b = document.getElementById("extrasKeyNewModal");
      const c = document.getElementById("extrasKeyNewConfirm");
      if (a) a.value = "";
      if (b) b.value = "";
      if (c) c.value = "";

      // al rotar, invalidamos extras actual
      window.KP?.Session?.clearExtras?.();

      paintEstadoBadge();
      paintTopMessage();

      // cerrar modal usando adminUi (fuente única de verdad)
      if (window.KP?.adminUi?.closeModal) {
        window.KP.adminUi.closeModal("modalRotateExtrasKey");
      } else {
        // fallback mínimo (no ideal, pero evita modal colgado)
        const modal = document.getElementById("modalRotateExtrasKey");
        if (modal) modal.hidden = true;
        const ov = document.getElementById("overlay");
        if (ov) ov.hidden = true;
        document.body.classList.remove("modal-open");
      }
    } catch (e) {
      setMsg && setMsg("rotateExtrasKeyMsg", e?.message || "No fue posible actualizar la clave.", "err");
    }
  }

  // =========================
  // Exports
  // =========================
  window.KP.adminExtras.isAdminSession = isAdminSession;
  window.KP.adminExtras.isExtrasActive = isExtrasActive;
  window.KP.adminExtras.ensureAdminOrRedirect = ensureAdminOrRedirect;

  window.KP.adminExtras.paintEstadoBadge = paintEstadoBadge;
  window.KP.adminExtras.paintTopMessage = paintTopMessage;
  window.KP.adminExtras.loadStatus = loadStatus;
  window.KP.adminExtras.ensureExtrasForAdmin = ensureExtrasForAdmin;

  window.KP.adminExtras.doPurgePedidosRange = doPurgePedidosRange;
  window.KP.adminExtras.doPurgePedidosAll = doPurgePedidosAll;
  window.KP.adminExtras.doPurgeAnomaliasRange = doPurgeAnomaliasRange;
  window.KP.adminExtras.doPurgeAnomaliasAll = doPurgeAnomaliasAll;

  window.KP.adminExtras.doRotateExtrasKey = doRotateExtrasKey;
})();
