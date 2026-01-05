// web/assets/js/exportar.js
(function () {
  window.KP = window.KP || {};
  window.KP.exportar = window.KP.exportar || {};
  window.KPREFRESH = window.KPREFRESH || {};

  function $(id) {
    return document.getElementById(id);
  }

  function setMsg(text, isErr = false) {
    const el = $("exportMsg");
    if (!el) return;
    el.style.color = isErr ? "#b00020" : "#555";
    el.textContent = text || "";
  }

  function isoToday() {
    return window.KP?.utils?.todayISO ? window.KP.utils.todayISO() : new Date().toISOString().slice(0, 10);
  }

  function clearErrors() {
    window.KP?.ui?.setErrors && window.KP.ui.setErrors({});
  }

  function validateRange(desde, hasta) {
    const fields = {};

    if (!desde) fields.desde = "Seleccione fecha de inicio.";
    if (!hasta) fields.hasta = "Seleccione fecha de término.";

    if (desde && desde.length < 8) fields.desde = "Fecha inválida.";
    if (hasta && hasta.length < 8) fields.hasta = "Fecha inválida.";

    if (desde && hasta && desde > hasta) {
      fields.hasta = "La fecha 'Hasta' debe ser mayor o igual a 'Desde'.";
    }

    window.KP?.ui?.setErrors && window.KP.ui.setErrors(fields);
    return fields;
  }

  function getRange() {
    const desde = ($("desdeFecha")?.value || "").trim();
    const hasta = ($("hastaFecha")?.value || "").trim();
    return { desde, hasta };
  }

  function triggerDownload(url) {
    window.location.href = url;
  }

  function buildUrl(kind, desde, hasta) {
    const qs = new URLSearchParams();
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);

    // ✅ Endpoint estable (según backend actual)
    return `/api/export/${kind}.csv?${qs.toString()}`;
  }

  async function runExport(kind) {
    clearErrors();
    setMsg("");

    const { desde, hasta } = getRange();
    const errors = validateRange(desde, hasta);
    if (Object.keys(errors).length) {
      setMsg("Revise el rango de fechas.", true);
      return;
    }

    const s = window.KP?.Session?.getRegistroTurno && window.KP.Session.getRegistroTurno();
    if (!s?.registro_turno_id) {
      setMsg("Sesión no iniciada. Vuelva a ingresar.", true);
      return;
    }

    setMsg("Generando exportación…");
    const url = buildUrl(kind, desde, hasta);

    triggerDownload(url);

    setTimeout(() => setMsg("Exportación solicitada. Si no se descarga, revise el rango o permisos.", false), 600);
  }

  function openCierreModal() {
    if (window.KP?.cierre?.open) {
      window.KP.cierre.open({
        onAccept: async () => {
          window.KP?.Session?.clear && window.KP.Session.clear();
          window.location.href = "/index.html";
        },
      });
      return;
    }

    window.KP?.Session?.clear && window.KP.Session.clear();
    window.location.href = "/index.html";
  }

  function bind() {
    const desdeEl = $("desdeFecha");
    const hastaEl = $("hastaFecha");

    const today = isoToday();
    if (desdeEl && !desdeEl.value) desdeEl.value = today;
    if (hastaEl && !hastaEl.value) hastaEl.value = today;

    $("btnExportPedidos")?.addEventListener("click", () => runExport("pedidos"));
    $("btnExportAnomalias")?.addEventListener("click", () => runExport("anomalias"));

    desdeEl?.addEventListener("change", () => {
      const { desde, hasta } = getRange();
      validateRange(desde, hasta);
    });
    hastaEl?.addEventListener("change", () => {
      const { desde, hasta } = getRange();
      validateRange(desde, hasta);
    });

    $("btnSalir")?.addEventListener("click", openCierreModal);
  }

  window.KP.exportar.initAll = function () {
    window.KP?.cierre?.initAll && window.KP.cierre.initAll();
    bind();
  };
})();
