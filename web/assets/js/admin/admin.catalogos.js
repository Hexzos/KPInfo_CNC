// web/assets/js/admin/admin.catalogos.js
(function () {
  window.KP = window.KP || {};
  window.KP.adminCatalogos = window.KP.adminCatalogos || {};

  const { setMsg, escHtml, normNombre } = window.KP.adminState || {};

  const API_ADMIN_CATALOGOS_GET = "/api/admin/catalogos";
  const API_ADMIN_CATALOGOS_CREATE = "/api/admin/catalogos/create";
  const API_ADMIN_CATALOGOS_UPDATE = "/api/admin/catalogos/update";
  const API_ADMIN_CATALOGOS_DELETE = "/api/admin/catalogos/delete";

  const API_VAR_ASIGNADAS_GET = "/api/admin/variaciones/asignadas";
  const API_VAR_ASIGNAR = "/api/admin/variaciones/asignar";
  const API_VAR_DESASIGNAR = "/api/admin/variaciones/desasignar";

  const CatalogUI = {
    materiales: { label: "Materiales", catalogoKey: "tipos_plancha", tbodyId: "materialesTbody" },
    variaciones: { label: "Variaciones", catalogoKey: "variaciones", tbodyId: "variacionesTbody" },
    turnos: { label: "Turnos", catalogoKey: "turnos", tbodyId: "turnosTbody" },
    maquinas: { label: "Máquinas", catalogoKey: "maquinas", tbodyId: "maquinasTbody" },
  };

  const State = {
    catalogos: { tipos_plancha: [], variaciones: [], turnos: [], maquinas: [] },
    varasig: { selectedTipoPlanchaId: 0, assigned: [], mounted: false },
  };

  function setCatalogosMsg(text, kind = "") {
    setMsg && setMsg("catalogosMsg", text, kind);
  }

  function rowActionsHTML(catalogoKey, item) {
    const id = Number(item?.id || 0);
    return `
      <div class="admin-row-actions">
        <button class="btn btn--light btn--xs" type="button"
          data-cat-action="edit" data-cat="${escHtml(catalogoKey)}" data-id="${id}">
          Editar
        </button>
        <button class="btn btn--light btn--xs" type="button"
          data-cat-action="del" data-cat="${escHtml(catalogoKey)}" data-id="${id}">
          Eliminar
        </button>
      </div>
    `;
  }

  function renderSimpleTable(tbodyId, catalogoKey, items) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Sin datos.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((it) => {
        const id = Number(it.id || 0);
        const nombre = escHtml(it.nombre || "");
        const activo = Number(it.activo ?? 1) ? "Sí" : "No";
        return `
          <tr>
            <td>${id}</td>
            <td>${nombre}</td>
            <td>${activo}</td>
            <td>${rowActionsHTML(catalogoKey, it)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function getCatalogBlocks() {
    const sec = document.getElementById("sec-catalogos");
    if (!sec) return [];
    const grid = sec.querySelector(".admin-grid2");
    if (!grid) return [];
    return Array.from(grid.children).filter((x) => x && x.nodeType === 1);
  }

  function findVariacionesBox() {
    const blocks = getCatalogBlocks();
    return blocks?.[1] || null;
  }

  async function fetchAdminCatalogos() {
    const payload = await window.KP.API.fetchJSON(API_ADMIN_CATALOGOS_GET, { method: "GET" });
    return payload?.data || {};
  }

  async function createCatalogItem(catalogoKey, nombre) {
    const payload = await window.KP.API.fetchJSON(API_ADMIN_CATALOGOS_CREATE, {
      method: "POST",
      body: JSON.stringify({ catalogo: catalogoKey, nombre }),
    });
    return payload?.data || null;
  }

  async function updateCatalogItem(catalogoKey, id, nombre) {
    const payload = await window.KP.API.fetchJSON(API_ADMIN_CATALOGOS_UPDATE, {
      method: "POST",
      body: JSON.stringify({ catalogo: catalogoKey, id, nombre }),
    });
    return payload?.data || null;
  }

  async function deleteCatalogItem(catalogoKey, id) {
    const payload = await window.KP.API.fetchJSON(API_ADMIN_CATALOGOS_DELETE, {
      method: "POST",
      body: JSON.stringify({ catalogo: catalogoKey, id }),
    });
    return payload?.data || null;
  }

  async function reloadCatalogos({ silent = false } = {}) {
    if (!silent) setCatalogosMsg("Cargando catálogos…", "");
    try {
      const data = await fetchAdminCatalogos();

      State.catalogos.tipos_plancha = Array.isArray(data.tipos_plancha) ? data.tipos_plancha : [];
      State.catalogos.variaciones = Array.isArray(data.variaciones) ? data.variaciones : [];
      State.catalogos.turnos = Array.isArray(data.turnos) ? data.turnos : [];
      State.catalogos.maquinas = Array.isArray(data.maquinas) ? data.maquinas : [];

      renderSimpleTable(CatalogUI.materiales.tbodyId, CatalogUI.materiales.catalogoKey, State.catalogos.tipos_plancha);
      renderSimpleTable(CatalogUI.variaciones.tbodyId, CatalogUI.variaciones.catalogoKey, State.catalogos.variaciones);
      renderSimpleTable(CatalogUI.turnos.tbodyId, CatalogUI.turnos.catalogoKey, State.catalogos.turnos);
      renderSimpleTable(CatalogUI.maquinas.tbodyId, CatalogUI.maquinas.catalogoKey, State.catalogos.maquinas);

      if (!silent) setCatalogosMsg("Catálogos cargados.", "ok");

      refreshVarasigIfReady();
    } catch (e) {
      if (!silent) setCatalogosMsg(e?.message || "No fue posible cargar los catálogos (admin).", "err");
    }
  }

  // ✅ helpers: modal prompt/confirm (con fallback defensivo)
  async function modalPrompt({ title, message, defaultValue = "" }) {
    const fn = window.KP?.catalogosModal?.prompt;
    if (typeof fn === "function") {
      return await fn({
        title,
        message,
        label: "Nombre",
        defaultValue,
        required: true,
        requiredMsg: "Ingrese un nombre.",
      });
    }
    // fallback (solo si no cargó el modal)
    return (prompt(`${title}\n${message}`) || "").trim() || null;
  }

  async function modalConfirm({ title, message }) {
    const fn = window.KP?.catalogosModal?.confirm;
    if (typeof fn === "function") {
      return await fn({ title, message, okText: "Aceptar", cancelText: "Cancelar" });
    }
    return confirm(message);
  }

  function bindCatalogButtonsExisting() {
    const blocks = getCatalogBlocks();
    if (blocks.length < 4) return;

    const map = [CatalogUI.materiales, CatalogUI.variaciones, CatalogUI.turnos, CatalogUI.maquinas];

    blocks.forEach((block, idx) => {
      const ui = map[idx];
      if (!ui) return;

      const btns = block.querySelectorAll(".admin-minihead__actions button");
      const btnNuevo = btns?.[0] || null;
      const btnActualizar = btns?.[1] || null;

      if (btnNuevo) {
        btnNuevo.disabled = false;
        btnNuevo.textContent = idx === 1 ? "Nueva" : "Nuevo";

        if (!btnNuevo.dataset.bound) {
          btnNuevo.dataset.bound = "1";
          btnNuevo.addEventListener("click", async () => {
            const raw = await modalPrompt({
              title: `Nuevo registro - ${ui.label}`,
              message: "Ingrese nombre *",
              defaultValue: "",
            });
            const nombre = normNombre((raw || "").trim());
            if (!nombre) return;

            setCatalogosMsg(`Creando en ${ui.label}…`, "");
            try {
              await createCatalogItem(ui.catalogoKey, nombre);
              await reloadCatalogos();
              setCatalogosMsg(`Creado correctamente en ${ui.label}.`, "ok");
            } catch (e) {
              setCatalogosMsg(e?.message || `No fue posible crear en ${ui.label}.`, "err");
            }
          });
        }
      }

      if (btnActualizar) {
        btnActualizar.disabled = false;
        btnActualizar.textContent = "Actualizar";

        if (!btnActualizar.dataset.bound) {
          btnActualizar.dataset.bound = "1";
          btnActualizar.addEventListener("click", async () => {
            await reloadCatalogos();
          });
        }
      }
    });
  }

  function bindCatalogRowActions() {
    const sec = document.getElementById("sec-catalogos");
    if (!sec) return;

    if (sec.dataset.bound) return;
    sec.dataset.bound = "1";

    sec.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("button[data-cat-action]");
      if (!btn) return;

      const action = (btn.getAttribute("data-cat-action") || "").trim();
      const catalogoKey = (btn.getAttribute("data-cat") || "").trim();
      const id = Number(btn.getAttribute("data-id") || 0);

      if (!catalogoKey || !id) return;

      if (action === "edit") {
        const raw = await modalPrompt({
          title: "Editar nombre",
          message: "Ingrese el nuevo nombre *",
          defaultValue: "",
        });
        const nuevo = normNombre((raw || "").trim());
        if (!nuevo) return;

        setCatalogosMsg("Actualizando…", "");
        try {
          await updateCatalogItem(catalogoKey, id, nuevo);
          await reloadCatalogos();
          setCatalogosMsg("Actualizado correctamente.", "ok");
        } catch (e) {
          setCatalogosMsg(e?.message || "No fue posible actualizar el registro.", "err");
        }
        return;
      }

      if (action === "del") {
        const okk = await modalConfirm({
          title: "Eliminar registro",
          message:
            "¿Eliminar este registro del catálogo?\n\nSi está referenciado por pedidos/anomalías o por la tabla puente, el sistema lo bloqueará.",
        });
        if (!okk) return;

        setCatalogosMsg("Eliminando…", "");
        try {
          await deleteCatalogItem(catalogoKey, id);
          await reloadCatalogos();
          setCatalogosMsg("Eliminado correctamente.", "ok");
        } catch (e) {
          setCatalogosMsg(e?.message || "No fue posible eliminar (posiblemente en uso).", "err");
        }
      }
    });
  }

  const Varasig = (function () {
    let panel = null;
    let selMaterial = null;
    let selVariacion = null;
    let btnAsignar = null;
    let btnRecargar = null;
    let listWrap = null;
    let info = null;

    function paintInfo(text, kind = "") {
      if (!info) return;
      info.textContent = text || "";
      info.classList.remove("msg--ok", "msg--err");
      if (kind === "ok") info.classList.add("msg--ok");
      if (kind === "err") info.classList.add("msg--err");
    }

    function fillSelects() {
      if (!selMaterial || !selVariacion) return;

      const mats = State.catalogos.tipos_plancha || [];
      const vars = State.catalogos.variaciones || [];

      selMaterial.innerHTML =
        `<option value="0">— Seleccione —</option>` +
        mats.map((m) => `<option value="${Number(m.id)}">${escHtml(m.nombre || "")}</option>`).join("");

      selVariacion.innerHTML =
        `<option value="0">— Seleccione —</option>` +
        vars.map((v) => `<option value="${Number(v.id)}">${escHtml(v.nombre || "")}</option>`).join("");

      if (State.varasig.selectedTipoPlanchaId) {
        selMaterial.value = String(State.varasig.selectedTipoPlanchaId);
      }
    }

    async function loadAssigned({ silent = false } = {}) {
      if (!selMaterial) return;

      const tpId = Number(selMaterial.value || 0);
      State.varasig.selectedTipoPlanchaId = tpId;

      if (!tpId) {
        State.varasig.assigned = [];
        renderAssigned();
        paintInfo("Seleccione un material para ver/gestionar sus variaciones.", "");
        return;
      }

      if (!silent) paintInfo("Cargando variaciones asignadas…", "");

      try {
        const url = `${API_VAR_ASIGNADAS_GET}?tipo_plancha_id=${encodeURIComponent(tpId)}`;
        const payload = await window.KP.API.fetchJSON(url, { method: "GET" });
        State.varasig.assigned = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        renderAssigned();
        if (!silent) paintInfo("Asignaciones cargadas.", "ok");
      } catch (e) {
        State.varasig.assigned = [];
        renderAssigned();
        paintInfo(e?.message || "No fue posible cargar las variaciones asignadas.", "err");
      }
    }

    function renderAssigned() {
      if (!listWrap) return;

      const tpId = Number(State.varasig.selectedTipoPlanchaId || 0);
      const assigned = State.varasig.assigned || [];

      if (!tpId) {
        listWrap.innerHTML = "";
        return;
      }

      if (!assigned.length) {
        listWrap.innerHTML = `<div class="muted" style="font-size:13px;">Sin variaciones asignadas para este material.</div>`;
        return;
      }

      listWrap.innerHTML = `
        <div style="font-size:12px; font-weight:800; margin-bottom:8px;">Variaciones asignadas</div>
        <div style="border:1px solid #e6e6e6; border-radius:2px; overflow:hidden; background:#fff;">
          <table class="admin-table" style="margin:0;">
            <thead><tr><th>ID</th><th>Nombre</th><th>Acciones</th></tr></thead>
            <tbody>
              ${assigned
                .map((it) => {
                  const id = Number(it.id || 0);
                  const nombre = escHtml(it.nombre || "");
                  return `
                    <tr>
                      <td>${id}</td>
                      <td>${nombre}</td>
                      <td>
                        <button class="btn btn--light btn--xs" type="button"
                          data-var-unassign="1" data-var-id="${id}">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;

      listWrap.querySelectorAll("button[data-var-unassign]").forEach((b) => {
        b.addEventListener("click", async () => {
          const vId = Number(b.getAttribute("data-var-id") || 0);
          const tpId2 = Number(State.varasig.selectedTipoPlanchaId || 0);
          if (!tpId2 || !vId) return;

          const okk = await modalConfirm({
            title: "Quitar variación",
            message: "¿Quitar esta variación del material seleccionado?",
          });
          if (!okk) return;

          paintInfo("Quitando asignación…", "");
          try {
            await window.KP.API.fetchJSON(API_VAR_DESASIGNAR, {
              method: "POST",
              body: JSON.stringify({ tipo_plancha_id: tpId2, variacion_id: vId }),
            });
            await loadAssigned({ silent: true });
            paintInfo("Asignación removida correctamente.", "ok");
          } catch (e) {
            paintInfo(e?.message || "No fue posible quitar la asignación.", "err");
          }
        });
      });
    }

    function mount() {
      if (State.varasig.mounted) return true;

      const root = findVariacionesBox();
      if (!root) return false;

      const tableWrap = root.querySelector(".admin-table-wrap");
      if (!tableWrap) return false;

      panel = document.createElement("div");
      panel.id = "varAssignPanel";
      panel.style.marginTop = "10px";
      panel.style.padding = "10px";
      panel.style.border = "1px solid #e6e6e6";
      panel.style.borderRadius = "2px";
      panel.style.background = "#fafafa";

      panel.innerHTML = `
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
          <div style="min-width:240px; flex:1 1 240px;">
            <label style="display:block; font-size:12px; font-weight:800; margin-bottom:6px;">Material (tipo de plancha)</label>
            <select id="varAssignMaterial" class="admin-search" style="width:100%; min-width:240px;"></select>
          </div>

          <div style="min-width:240px; flex:1 1 240px;">
            <label style="display:block; font-size:12px; font-weight:800; margin-bottom:6px;">Agregar variación</label>
            <select id="varAssignVariacion" class="admin-search" style="width:100%; min-width:240px;"></select>
          </div>

          <div style="display:flex; gap:10px;">
            <button id="btnVarAssignAdd" class="btn btn--primary" type="button">Asignar</button>
            <button id="btnVarAssignReload" class="btn btn--light" type="button">Recargar asignadas</button>
          </div>
        </div>

        <div id="varAssignInfo" class="msg" style="margin-top:10px;"></div>
        <div id="varAssignListWrap" style="margin-top:10px;"></div>
      `;

      tableWrap.parentNode.insertBefore(panel, tableWrap);

      selMaterial = panel.querySelector("#varAssignMaterial");
      selVariacion = panel.querySelector("#varAssignVariacion");
      btnAsignar = panel.querySelector("#btnVarAssignAdd");
      btnRecargar = panel.querySelector("#btnVarAssignReload");
      listWrap = panel.querySelector("#varAssignListWrap");
      info = panel.querySelector("#varAssignInfo");

      selMaterial.addEventListener("change", async () => {
        State.varasig.selectedTipoPlanchaId = Number(selMaterial.value || 0);
        await loadAssigned();
      });

      btnRecargar.addEventListener("click", () => loadAssigned());

      btnAsignar.addEventListener("click", async () => {
        const tpId = Number(selMaterial.value || 0);
        const vId = Number(selVariacion.value || 0);
        if (!tpId) return paintInfo("Seleccione un material.", "err");
        if (!vId) return paintInfo("Seleccione una variación para asignar.", "err");

        paintInfo("Asignando…", "");
        try {
          await window.KP.API.fetchJSON(API_VAR_ASIGNAR, {
            method: "POST",
            body: JSON.stringify({ tipo_plancha_id: tpId, variacion_id: vId }),
          });
          await loadAssigned({ silent: true });
          paintInfo("Variación asignada correctamente.", "ok");
        } catch (e) {
          paintInfo(e?.message || "No fue posible asignar la variación.", "err");
        }
      });

      State.varasig.mounted = true;
      fillSelects();
      paintInfo("Seleccione un material para ver/gestionar sus variaciones.", "");
      return true;
    }

    function refreshIfReady() {
      if (!State.varasig.mounted) return;
      fillSelects();
      if (State.varasig.selectedTipoPlanchaId) loadAssigned({ silent: true });
    }

    return { mount, refreshIfReady };
  })();

  function refreshVarasigIfReady() {
    Varasig.refreshIfReady();
  }

  function initAll() {
    bindCatalogButtonsExisting();
    bindCatalogRowActions();

    reloadCatalogos().then(() => {
      Varasig.mount();
    });
  }

  window.KP.adminCatalogos.State = State;
  window.KP.adminCatalogos.reloadCatalogos = reloadCatalogos;
  window.KP.adminCatalogos.initAll = initAll;
})();
