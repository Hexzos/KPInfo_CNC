// web/assets/js/anomalias.modal.crear.js
(function () {
  window.KP = window.KP || {};
  window.KP.anomalias = window.KP.anomalias || {};

  function setMsg(text, isErr = false) {
    const el = document.getElementById("anomaliaMsg");
    if (!el) return;
    el.style.color = isErr ? "#b00020" : "#444";
    el.textContent = text || "";
  }

  function closeWithOverlayRule() {
    const overlay = document.getElementById("overlay");
    const modal = document.getElementById("modalAnomalia");
    if (modal) modal.hidden = true;

    // Si detalle está abierto, mantener overlay
    const det = document.getElementById("modalAnomaliaDetalle");
    const detOpen = det && !det.hidden;

    if (overlay) overlay.hidden = !detOpen;
    setMsg("");
    window.KP.ui.setErrors({});
    document.removeEventListener("keydown", onKey);
  }

  function onKey(ev) {
    if (ev.key === "Escape") closeWithOverlayRule();
  }

  async function loadCatalogosIntoSelects() {
    const turnoSel = document.getElementById("turnoSel");
    const maqSel = document.getElementById("maquinaSel");
    if (!turnoSel || !maqSel) return;

    const res = await window.KP.API.fetchJSON("/api/catalogos");
    const turnos = res?.data?.turnos || [];
    const maquinas = res?.data?.maquinas || [];

    // Turnos
    turnoSel.innerHTML = `<option value="" selected disabled>Seleccione un turno</option>`;
    turnos.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = String(t.id);
      opt.textContent = t.nombre;
      turnoSel.appendChild(opt);
    });

    // Máquinas
    maqSel.innerHTML = `<option value="" selected disabled>Seleccione la máquina CNC</option>`;
    maquinas.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = m.nombre;
      maqSel.appendChild(opt);
    });
  }

  function getForm() {
    return {
      fecha: document.getElementById("anomaliaFecha"), // readonly DIV
      turno: document.getElementById("turnoSel"),
      maq: document.getElementById("maquinaSel"),
      tit: document.getElementById("tituloAnomalia"),
      desc: document.getElementById("descAnomalia"),
      btn: document.getElementById("btnGenerarAnomalia"),
      x: document.getElementById("btnCerrarModalAnomalia"),
      form: document.getElementById("formAnomalia"),
    };
  }

  function validateClient(dto) {
    const fields = {};
    if (!dto.turno_id) fields.turno_id = "Seleccione un turno.";
    if (!dto.maquina_id) fields.maquina_id = "Seleccione máquina asignada.";
    if (!dto.titulo || dto.titulo.trim().length < 2) fields.titulo = "Nombre del problema (mínimo 2 caracteres).";
    if (!dto.descripcion || dto.descripcion.trim().length < 10) fields.descripcion = "Descripción (mínimo 10 caracteres).";
    return fields;
  }

  window.KP.anomalias.initCrearModal = function () {
    const overlay = document.getElementById("overlay");
    const modal = document.getElementById("modalAnomalia");
    if (!overlay || !modal) return;

    if (modal.dataset.inited === "1") return;
    modal.dataset.inited = "1";

    const f = getForm();

    f.x?.addEventListener("click", closeWithOverlayRule);

    window.KP.anomalias.openCrear = async function () {
      overlay.hidden = false;
      modal.hidden = false;

      // Prefill fecha (readonly)
      if (f.fecha) f.fecha.textContent = window.KP.utils.todayISO();

      setMsg("Cargando catálogos…");
      window.KP.ui.setErrors({});

      try {
        await loadCatalogosIntoSelects();
        setMsg("");
      } catch (e) {
        setMsg(e.message || "No fue posible cargar catálogos.", true);
      }

      document.addEventListener("keydown", onKey);
    };

    async function submit(ev) {
      ev?.preventDefault?.();

      const s = window.KP.Session.getRegistroTurno();
      if (!s?.registro_turno_id) {
        setMsg("Sesión no iniciada. Vuelva a ingresar.", true);
        return;
      }

      const dto = {
        registro_turno_id: Number(s.registro_turno_id),
        turno_id: Number(f.turno?.value || 0) || null,
        maquina_id: Number(f.maq?.value || 0) || null,
        titulo: (f.tit?.value || "").trim(),
        descripcion: (f.desc?.value || "").trim(),
        // El backend ya tiene default, pero lo mandamos por consistencia UI
        fecha_registro: window.KP.utils.todayISO(),
      };

      const errors = validateClient(dto);
      window.KP.ui.setErrors(errors);
      if (Object.keys(errors).length) {
        setMsg("Revise los campos obligatorios.", true);
        return;
      }

      setMsg("Registrando anomalía…");
      if (f.btn) f.btn.disabled = true;

      try {
        await window.KP.API.fetchJSON("/api/anomalias", {
          method: "POST",
          body: JSON.stringify(dto),
        });

        // Limpiar form
        if (f.turno) f.turno.value = "";
        if (f.maq) f.maq.value = "";
        if (f.tit) f.tit.value = "";
        if (f.desc) f.desc.value = "";
        window.KP.ui.setErrors({});

        // Refrescar listado (patrón del proyecto)
        if (window.KPREFRESH?.refreshAnomalias) {
          await window.KPREFRESH.refreshAnomalias();
        } else if (window.KP.anomalias?.refreshList) {
          await window.KP.anomalias.refreshList();
        }

        closeWithOverlayRule();
      } catch (e) {
        setMsg(e.message || "No fue posible crear la anomalía.", true);
      } finally {
        if (f.btn) f.btn.disabled = false;
      }
    }

    // Submit por form (recomendado) y por click (defensa)
    f.form?.addEventListener("submit", submit);
    f.btn?.addEventListener("click", submit);
  };
})();
