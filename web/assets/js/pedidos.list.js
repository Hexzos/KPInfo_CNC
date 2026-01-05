// web/assets/js/pedidos.list.js
(function () {
  window.KP = window.KP || {};
  window.KP.pedidos = window.KP.pedidos || {};
  window.KPREFRESH = window.KPREFRESH || {};

  function estadoLabel(estado) {
    if (estado === "en_proceso") return "En proceso";
    if (estado === "completado") return "Completado";
    if (estado === "cancelado") return "Cancelado";
    return estado || "En proceso";
  }

  function estadoClass(estado) {
    if (estado === "en_proceso") return "tag--proceso";
    if (estado === "completado") return "tag--ok";
    if (estado === "cancelado") return "tag--bad";
    return "tag--neutral";
  }

  function isExtrasEnabled() {
    return !!(window.KP?.Session?.isExtrasEnabled && window.KP.Session.isExtrasEnabled());
  }

  function applyExtrasUIVisibility(selectEl) {
    if (!selectEl) return;

    const extras = isExtrasEnabled();
    const opt = selectEl.querySelector('option[value="archivado"]');
    if (opt) opt.hidden = !extras;

    if (!extras && selectEl.value === "archivado") {
      selectEl.value = "general";
    }
  }

  async function loadPedidos({ lista = "general", q = "" } = {}) {
    const qs = new URLSearchParams();

    // Archivados como flag (no como estado real)
    if (lista === "archivado") {
      qs.set("archivados", "1");
    } else {
      qs.set("estado", lista || "general");
    }

    if (q && q.trim()) qs.set("q", q.trim());

    const url = "/api/pedidos" + (qs.toString() ? `?${qs.toString()}` : "");
    const { data } = await window.KP.API.fetchJSON(url);
    return data?.items || [];
  }

  function renderPedidos(items) {
    const empty = document.getElementById("emptyState");
    const cards = document.getElementById("cards");
    if (!empty || !cards) return;

    if (!items || items.length === 0) {
      empty.hidden = false;
      cards.hidden = true;
      cards.innerHTML = "";
      return;
    }

    empty.hidden = true;
    cards.hidden = false;
    cards.innerHTML = "";

    const tpl = document.getElementById("pedidoTpl");
    if (!tpl) return;

    const frag = document.createDocumentFragment();

    items.forEach((p) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = p.id;

      const $ = (sel) => node.querySelector(sel);

      const codeEl = $("[data-code]");
      const descEl = $("[data-desc]");
      const turnoEl = $("[data-turno]");
      const fechaEl = $("[data-fecha]");
      const maqEl = $("[data-maquina]");
      const estadoEl = $("[data-estado]");

      if (codeEl) codeEl.textContent = p.codigo_producto || "";
      if (descEl) descEl.textContent = p.descripcion_producto || "";
      if (turnoEl) turnoEl.textContent = p.turno_nombre || "";
      if (fechaEl) fechaEl.textContent = p.fecha_registro || "";
      if (maqEl) maqEl.textContent = p.maquina_asignada || "";

      const estado = p.estado || "en_proceso";
      if (estadoEl) {
        estadoEl.textContent = estadoLabel(estado);
        estadoEl.classList.remove("tag--proceso", "tag--ok", "tag--bad", "tag--neutral");
        estadoEl.classList.add(estadoClass(estado));
      }

      node.addEventListener("click", () => {
        const id = Number(p.id || 0);
        if (id > 0 && window.KP.pedidos.openDetalle) window.KP.pedidos.openDetalle(id);
      });

      frag.appendChild(node);
    });

    cards.appendChild(frag);
  }

  window.KP.pedidos.initPedidosPage = function () {
    const listaSel = document.getElementById("listaSel");
    const qInput = document.getElementById("q");
    if (!listaSel || !qInput) return;

    applyExtrasUIVisibility(listaSel);

    async function refresh() {
      applyExtrasUIVisibility(listaSel);

      const lista = (listaSel.value || "general").trim();
      const q = (qInput.value || "").trim();

      try {
        const items = await loadPedidos({ lista, q });
        renderPedidos(items);
      } catch (e) {
        console.warn("No fue posible cargar pedidos:", e);
      }
    }

    window.KPREFRESH.refreshPedidos = refresh;

    listaSel.addEventListener("change", refresh);

    const onSearch = window.KP.utils.debounce(() => refresh(), 250);
    qInput.addEventListener("input", onSearch);

    queueMicrotask(() => refresh());
  };
})();
