// web/assets/js/admin/admin.page.js
(function () {
  window.KP = window.KP || {};
  window.KP.admin = window.KP.admin || {};
  window.KP.admin.page = window.KP.admin.page || {};

  const UI = window.KP.adminUI || {};
  const Extras = window.KP.adminExtras || {};
  const Catalogos = window.KP.adminCatalogos || {};
  const { setMsg } = window.KP.adminState || {};

  function byId(id) {
    return document.getElementById(id);
  }

  function bindOnce(el, key, fn) {
    if (!el) return;
    if (el.dataset && el.dataset[key]) return;
    if (el.dataset) el.dataset[key] = "1";
    el.addEventListener("click", fn);
  }

  function clearModalMsgs() {
    setMsg && setMsg("purgePedidosMsg", "", "");
    setMsg && setMsg("purgeAnomaliasMsg", "", "");
    setMsg && setMsg("rotateExtrasKeyMsg", "", "");
  }

  function bindModalOpeners() {
    bindOnce(byId("btnOpenPurgePedidos"), "boundOpen", () => {
      clearModalMsgs();
      UI.openModal && UI.openModal("modalPurgePedidos");
    });

    bindOnce(byId("btnOpenPurgeAnomalias"), "boundOpen", () => {
      clearModalMsgs();
      UI.openModal && UI.openModal("modalPurgeAnomalias");
    });

    bindOnce(byId("btnOpenRotateExtrasKey"), "boundOpen", () => {
      clearModalMsgs();
      UI.openModal && UI.openModal("modalRotateExtrasKey");
    });
  }

  function bindModalActions() {
    bindOnce(byId("btnDoPurgePedidosRange"), "boundAct", () => Extras.doPurgePedidosRange && Extras.doPurgePedidosRange());
    bindOnce(byId("btnDoPurgePedidosAll"), "boundAct", () => Extras.doPurgePedidosAll && Extras.doPurgePedidosAll());

    bindOnce(byId("btnDoPurgeAnomaliasRange"), "boundAct", () => Extras.doPurgeAnomaliasRange && Extras.doPurgeAnomaliasRange());
    bindOnce(byId("btnDoPurgeAnomaliasAll"), "boundAct", () => Extras.doPurgeAnomaliasAll && Extras.doPurgeAnomaliasAll());

    bindOnce(byId("btnDoRotateExtrasKey"), "boundAct", () => Extras.doRotateExtrasKey && Extras.doRotateExtrasKey());
  }

  async function initAll() {
    if (Extras.ensureAdminOrRedirect && !Extras.ensureAdminOrRedirect()) return;

    UI.initAll && UI.initAll();
    bindModalOpeners();
    bindModalActions();

    try {
      await (Extras.loadStatus && Extras.loadStatus());
    } catch {}

    try {
      await (Extras.ensureExtrasForAdmin && Extras.ensureExtrasForAdmin());
    } catch {}

    try {
      Catalogos.initAll && Catalogos.initAll();
    } catch (e) {
      setMsg && setMsg("catalogosMsg", e?.message || "No fue posible inicializar catálogos.", "err");
    }
  }

  window.KP.admin.page.initAll = initAll;
})();
