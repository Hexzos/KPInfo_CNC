// web/assets/js/admin/admin.main.js
(function () {
  window.KP = window.KP || {};
  window.KP.admin = window.KP.admin || {};

  function initAdminTabs() {
    const tabs = Array.from(document.querySelectorAll(".admin-tab"));
    if (!tabs.length) return;

    function applyActive() {
      const hash = (window.location.hash || "#sec-estado").trim();
      tabs.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === hash));
    }

    window.addEventListener("hashchange", applyActive);
    applyActive();
  }

  function openModal(id) {
    const ov = document.getElementById("overlay");
    const m = document.getElementById(id);
    if (!m) return;
    if (ov) ov.hidden = false;
    m.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(id) {
    const ov = document.getElementById("overlay");
    const m = document.getElementById(id);
    if (!m) return;
    m.hidden = true;

    const anyOpen = Array.from(document.querySelectorAll(".modal")).some((x) => x && x.hidden === false);
    if (ov) ov.hidden = anyOpen ? false : true;
    if (!anyOpen) document.body.classList.remove("modal-open");
  }

  function bindSalir() {
    const btn = document.getElementById("btnSalir");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (window.KP?.cierre?.open) {
        window.KP.cierre.open({
          onAccept: async () => {
            window.KP?.Session?.clear && window.KP.Session.clear();
            window.location.href = "/index.html";
          },
        });
        return;
      }
      window.KP.Session.clear();
      window.location.href = "/index.html";
    });
  }

  function disableUsuariosSection() {
    const { setMsg } = window.KP.adminState || {};
    const btnRefresh = document.getElementById("btnRefreshUsers");
    const btnCreate = document.getElementById("btnOpenUserCreate");
    const q = document.getElementById("userQ");

    if (btnRefresh) btnRefresh.disabled = true;
    if (btnCreate) btnCreate.disabled = true;
    if (q) q.disabled = true;

    setMsg && setMsg("usersMsg", "CRUD de usuarios: descartado por tiempo (se mantiene sección solo como placeholder).", "");
  }

  function bindActions() {
    document.getElementById("btnOpenPurgePedidos")?.addEventListener("click", () => openModal("modalPurgePedidos"));
    document.getElementById("btnOpenPurgeAnomalias")?.addEventListener("click", () => openModal("modalPurgeAnomalias"));
    document.getElementById("btnOpenRotateExtrasKey")?.addEventListener("click", () => openModal("modalRotateExtrasKey"));

    // Delegamos acciones a adminExtras
    document.getElementById("btnDoPurgePedidosRange")?.addEventListener("click", () => window.KP.adminExtras?.doPurgePedidosRange?.());
    document.getElementById("btnDoPurgePedidosAll")?.addEventListener("click", () => window.KP.adminExtras?.doPurgePedidosAll?.());
    document.getElementById("btnDoPurgeAnomaliasRange")?.addEventListener("click", () => window.KP.adminExtras?.doPurgeAnomaliasRange?.());
    document.getElementById("btnDoPurgeAnomaliasAll")?.addEventListener("click", () => window.KP.adminExtras?.doPurgeAnomaliasAll?.());
    document.getElementById("btnDoRotateExtrasKey")?.addEventListener("click", () => window.KP.adminExtras?.doRotateExtrasKey?.());

    const ov = document.getElementById("overlay");
    if (ov) {
      ov.addEventListener("click", () => {
        Array.from(document.querySelectorAll(".modal")).forEach((m) => {
          if (m && m.hidden === false) m.hidden = true;
        });
        ov.hidden = true;
        document.body.classList.remove("modal-open");
      });
    }

    document.querySelectorAll("[data-close]").forEach((b) => {
      b.addEventListener("click", () => closeModal(b.getAttribute("data-close")));
    });
  }

  window.KP.admin.initAll = async function () {
    if (window.KP.adminExtras?.ensureAdminOrRedirect && !window.KP.adminExtras.ensureAdminOrRedirect()) return;

    initAdminTabs();

    await window.KP.adminExtras?.loadStatus?.();
    await window.KP.adminExtras?.ensureExtrasForAdmin?.();

    bindSalir();
    bindActions();
    disableUsuariosSection();

    await window.KP.adminCatalogos?.init?.();
    window.KP.adminVarAsig?.init?.();

    window.KPINIT?.applyRoleUI?.();
  };
})();
