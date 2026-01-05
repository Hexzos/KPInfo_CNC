// web/assets/js/pedidos.modal.crear.js
(function () {
  window.KP = window.KP || {};
  window.KP.pedidos = window.KP.pedidos || {};

  async function loadCatalogos() {
    const { data } = await window.KP.API.fetchJSON("/api/catalogos");
    return data;
  }

  // =========================
  // ✅ Input numérico robusto
  // =========================
  function bindNumericOnly(inputEl, { allowDecimal = false } = {}) {
    if (!inputEl) return;

    const allowedKeys = new Set([
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Tab",
      "Home",
      "End",
      "Enter",
    ]);

    inputEl.addEventListener("keydown", (ev) => {
      if (allowedKeys.has(ev.key)) return;
      if (ev.ctrlKey || ev.metaKey) return;

      if (ev.key === "e" || ev.key === "E" || ev.key === "+" || ev.key === "-") {
        ev.preventDefault();
        return;
      }

      if (ev.key === "." || ev.key === ",") {
        if (!allowDecimal) {
          ev.preventDefault();
          return;
        }
        const cur = String(inputEl.value || "");
        if (cur.includes(".") || cur.includes(",")) ev.preventDefault();
        return;
      }

      if (!/^\d$/.test(ev.key)) ev.preventDefault();
    });

    inputEl.addEventListener("input", () => {
      let v = String(inputEl.value || "");

      if (allowDecimal) {
        v = v.replace(/[^\d.,]/g, "");

        const parts = v.split(/[.,]/);
        if (parts.length > 2) {
          v = parts[0] + "." + parts.slice(1).join("");
        }

        v = v.replace(",", ".");
      } else {
        v = v.replace(/[^\d]/g, "");
      }

      if (inputEl.value !== v) inputEl.value = v;
    });

    inputEl.addEventListener(
      "wheel",
      () => {
        inputEl.blur();
      },
      { passive: true }
    );
  }

  window.KP.pedidos.initPedidoModal = async function () {
    const overlay = document.getElementById("overlay");
    const modal = document.getElementById("modalPedido");
    const btnClose = document.getElementById("btnCerrarModalPedido");
    const fab = document.getElementById("fabCrear");

    if (!overlay || !modal || !fab) return;

    if (modal.dataset.inited === "1") return;
    modal.dataset.inited = "1";

    const form = document.getElementById("formPedido");
    const msg = document.getElementById("pedidoMsg");

    const fechaEl = document.getElementById("pedidoFecha");
    const turnoSel = document.getElementById("turnoSel");
    const tipoSel = document.getElementById("tipoPlanchaSel");
    const variSel = document.getElementById("variacionSel");

    const espesorEl = document.getElementById("espesorMm");
    const planchasEl = document.getElementById("planchasAsignadas");

    bindNumericOnly(espesorEl, { allowDecimal: true });
    bindNumericOnly(planchasEl, { allowDecimal: false });

    if (espesorEl) espesorEl.setAttribute("inputmode", "decimal");
    if (planchasEl) planchasEl.setAttribute("inputmode", "numeric");

    overlay.hidden = true;
    modal.hidden = true;

    if (fechaEl) fechaEl.textContent = window.KP.utils.todayISO();
    const KEEP_MODAL_OPEN_AFTER_CREATE = true;

    function onKey(ev) {
      if (ev.key === "Escape") close();
    }

    function open() {
      overlay.hidden = false;
      modal.hidden = false;
      if (msg) {
        msg.style.color = "#111";
        msg.textContent = "";
      }
      window.KP.ui.setErrors({});
      document.addEventListener("keydown", onKey);
    }

    function close() {
      modal.hidden = true;
      overlay.hidden = true;

      if (form) form.reset();
      if (fechaEl) fechaEl.textContent = window.KP.utils.todayISO();
      if (variSel) variSel.innerHTML = `<option value="" disabled selected>Seleccionar propiedades extra</option>`;
      document.removeEventListener("keydown", onKey);
    }

    btnClose?.addEventListener("click", close);
    fab.addEventListener("click", open);

    // =========================
    // Catálogos + mapeo variaciones
    // =========================
    let catalogos = null;
    try {
      catalogos = await loadCatalogos();

      if (turnoSel) {
        turnoSel.innerHTML =
          `<option value="" disabled selected>Seleccione un turno</option>` +
          (catalogos.turnos || []).map((t) => `<option value="${t.id}">${t.nombre}</option>`).join("");
      }

      if (tipoSel) {
        const tipos = catalogos.tipos_plancha || [];
        tipoSel.innerHTML =
          `<option value="" disabled selected>Seleccione el tipo de plancha</option>` +
          tipos.map((tp) => `<option value="${tp.id}" data-nombre="${tp.nombre}">${tp.nombre}</option>`).join("");
      }
    } catch (e) {
      if (msg) {
        msg.style.color = "#b00020";
        msg.textContent = "No fue posible cargar catálogos.";
      }
    }

    // ✅ NUEVO: variaciones desde tabla puente
    function renderVariacionesForTipo(tipoPlanchaId) {
      const map = catalogos?.tipo_plancha_variaciones || {};
      const items = map[String(tipoPlanchaId)] || map[tipoPlanchaId] || [];

      // fallback mínimo: siempre permitir "Otro"
      const list = Array.isArray(items) ? items.slice() : [];

      if (variSel) {
        if (!list.length) {
          variSel.innerHTML =
            `<option value="" disabled selected>Seleccionar propiedades extra</option>` +
            `<option value="Otro">Otro</option>`;
          return;
        }

        variSel.innerHTML =
          `<option value="" disabled selected>Seleccionar propiedades extra</option>` +
          list.map((v) => `<option value="${v.nombre}">${v.nombre}</option>`).join("") +
          `<option value="Otro">Otro</option>`;
      }
    }

    tipoSel?.addEventListener("change", () => {
      const tpId = Number(tipoSel.value || 0);
      if (!tpId) {
        if (variSel) variSel.innerHTML = `<option value="" disabled selected>Seleccionar propiedades extra</option>`;
        return;
      }
      renderVariacionesForTipo(tpId);
    });

    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (msg) msg.textContent = "";
      window.KP.ui.setErrors({});

      const s = window.KP.Session.getRegistroTurno();
      if (!s?.registro_turno_id) {
        window.location.href = "/index.html";
        return;
      }

      const dto = {
        registro_turno_id: s.registro_turno_id,
        turno_id: Number(turnoSel?.value || 0),
        maquina_asignada: document.getElementById("maquinaAsignadaSel")?.value || "",
        codigo_producto: document.getElementById("codigoProducto")?.value.trim() || "",
        descripcion_producto: document.getElementById("descripcionProducto")?.value.trim() || "",
        tipo_plancha_id: Number(tipoSel?.value || 0),
        espesor_mm: parseFloat(document.getElementById("espesorMm")?.value || "0") || 0,
        medida_plancha: document.getElementById("medidaPlancha")?.value.trim() || "",
        variacion_material: variSel?.value || "",
        planchas_asignadas: parseInt(document.getElementById("planchasAsignadas")?.value || "0", 10) || 0,
      };

      const fields = {};
      if (!Number.isInteger(dto.turno_id) || dto.turno_id <= 0) fields.turno_id = "Seleccione un turno.";
      if (!dto.maquina_asignada) fields.maquina_asignada = "Seleccione máquina asignada.";
      if (dto.codigo_producto.length < 1) fields.codigo_producto = "Campo obligatorio.";
      if (dto.descripcion_producto.length < 10) fields.descripcion_producto = "Mínimo 10 caracteres.";
      if (!Number.isInteger(dto.tipo_plancha_id) || dto.tipo_plancha_id <= 0) fields.tipo_plancha_id = "Seleccione tipo de plancha.";
      if (!(dto.espesor_mm > 0)) fields.espesor_mm = "Debe ser mayor a 0.";
      if (dto.medida_plancha.length < 3) fields.medida_plancha = "Ingrese medida válida.";
      if (!dto.variacion_material) fields.variacion_material = "Seleccione variación.";
      if (!Number.isInteger(dto.planchas_asignadas) || dto.planchas_asignadas <= 0) fields.planchas_asignadas = "Debe ser entero mayor que 0.";

      if (Object.keys(fields).length) {
        window.KP.ui.setErrors(fields);
        return;
      }

      try {
        await window.KP.API.fetchJSON("/api/pedidos", { method: "POST", body: JSON.stringify(dto) });
        if (msg) {
          msg.style.color = "green";
          msg.textContent = "Pedido creado correctamente.";
        }
        if (window.KPREFRESH?.refreshPedidos) await window.KPREFRESH.refreshPedidos();
        if (!KEEP_MODAL_OPEN_AFTER_CREATE) setTimeout(close, 250);
      } catch (e) {
        if (msg) {
          msg.style.color = "#b00020";
          msg.textContent = e.message || "No fue posible crear el pedido.";
        }
      }
    });
  };
})();
