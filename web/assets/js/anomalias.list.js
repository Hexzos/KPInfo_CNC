// web/assets/js/anomalias.list.js
(function () {
  window.KP = window.KP || {};
  window.KP.anomalias = window.KP.anomalias || {};
  window.KPREFRESH = window.KPREFRESH || {};

  function estadoLabel(estado) {
    return estado === "solucionado" ? "Solucionado" : "En revisión";
  }

  function estadoClass(estado) {
    return estado === "solucionado" ? "tag--ok" : "tag--proceso";
  }

  function safeText(el, txt) {
    if (el) el.textContent = txt || "";
  }

  function render(items) {
    const list = document.getElementById("cards");
    const tpl = document.getElementById("anomaliaTpl");
    const empty = document.getElementById("emptyState");
    if (!list || !tpl || !empty) return;

    list.innerHTML = "";
    const n = Array.isArray(items) ? items.length : 0;

    empty.hidden = n !== 0;
    list.hidden = n === 0;

    if (n === 0) return;

    const frag = document.createDocumentFragment();

    items.forEach((a) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = a.id;

      const $ = (sel) => node.querySelector(sel);

      const titEl = $("[data-titulo]");
      const descEl = $("[data-desc]");
      const turnoEl = $("[data-turno]");
      const fechaEl = $("[data-fecha]");
      const maqEl = $("[data-maquina]");
      const estadoEl = $("[data-estado]");

      if (titEl) titEl.textContent = a.titulo || "";

      if (descEl) {
        const d = a.descripcion || "";
        descEl.textContent = d.slice(0, 72) + (d.length > 72 ? "…" : "");
      }

      if (turnoEl) turnoEl.textContent = a.turno_nombre || "";
      if (fechaEl) fechaEl.textContent = a.fecha_registro || "";
      if (maqEl) maqEl.textContent = a.maquina_nombre || "";

      const est = a.estado || "en_revision";
      if (estadoEl) {
        estadoEl.textContent = estadoLabel(est);
        estadoEl.classList.remove("tag--proceso", "tag--ok", "tag--neutral");
        estadoEl.classList.add(estadoClass(est));
      }

      node.addEventListener("click", () => {
        const id = Number(a.id || 0);
        if (id > 0 && window.KP.anomalias?.openDetalle) window.KP.anomalias.openDetalle(id);
      });

      frag.appendChild(node);
    });

    list.appendChild(frag);
  }

  function isExtras() {
    return !!(window.KP?.Session?.isExtrasEnabled && window.KP.Session.isExtrasEnabled());
  }

  function applyExtrasUIVisibility() {
    const estadoSel = document.getElementById("listaSel");
    if (!estadoSel) return;

    const extras = isExtras();

    const optArchivado = estadoSel.querySelector('option[value="archivado"]');
    if (optArchivado) optArchivado.hidden = !extras;

    if (!extras && (estadoSel.value || "").trim() === "archivado") {
      estadoSel.value = "general";
    }
  }

  async function fetchList() {
    const estadoSel = document.getElementById("listaSel");
    const buscar = document.getElementById("q");

    const estadoRaw = (estadoSel?.value || "general").trim();
    const q = (buscar?.value || "").trim();

    const qs = new URLSearchParams();

    if (estadoRaw === "archivado") {
      if (isExtras()) {
        qs.set("archivados", "1");
        qs.set("estado", "todos");
      } else {
        qs.set("estado", "todos");
      }
    } else {
      const backendEstado = (estadoRaw === "general") ? "todos" : estadoRaw;
      qs.set("estado", backendEstado || "todos");
    }

    if (q) qs.set("q", q);

    const res = await window.KP.API.fetchJSON(`/api/anomalias?${qs.toString()}`);
    const items = res?.data?.items || [];
    render(items);
  }

  function bindControls() {
    const estadoSel = document.getElementById("listaSel");
    const buscar = document.getElementById("q");
    const fab = document.getElementById("fabCrear");

    estadoSel?.addEventListener("change", () => window.KP.anomalias.refreshList());

    if (buscar) {
      buscar.addEventListener(
        "input",
        window.KP.utils.debounce(() => window.KP.anomalias.refreshList(), 250)
      );
    }

    fab?.addEventListener("click", () => {
      window.KP.anomalias.openCrear && window.KP.anomalias.openCrear();
    });
  }

  window.KP.anomalias.initAnomaliasPage = function () {
    const s = window.KP?.Session?.getRegistroTurno && window.KP.Session.getRegistroTurno();
    const sessionInfo = document.getElementById("sessionInfo");
    if (s?.registro_turno_id) {
      safeText(sessionInfo, `${s.operador_nombre} ${s.operador_apellido} · ${s.fecha || "—"}`);
    } else {
      safeText(sessionInfo, "Sesión no iniciada");
    }

    applyExtrasUIVisibility();
    bindControls();

    window.KPREFRESH.refreshAnomalias =
      window.KPREFRESH.refreshAnomalias ||
      (async function () {
        if (window.KP.anomalias.refreshList) return window.KP.anomalias.refreshList();
      });

    if (window.KPREFRESH.refreshAnomalias) window.KPREFRESH.refreshAnomalias();
  };

  window.KP.anomalias.refreshList = async function () {
    try {
      applyExtrasUIVisibility();
      await fetchList();
    } catch (e) {
      console.error(e);
    }
  };
})();
