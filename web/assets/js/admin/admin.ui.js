// web/assets/js/admin/admin.ui.js
(function () {
  window.KP = window.KP || {};
  window.KP.adminUI = window.KP.adminUI || {};

  function byId(id) {
    return document.getElementById(id);
  }

  function overlay() {
    return byId("overlay");
  }

  function anyModalOpen() {
    return !!document.querySelector(".modal:not([hidden])");
  }

  function openModal(modalId) {
    const ov = overlay();
    const modal = byId(modalId);
    if (ov) ov.hidden = false;
    if (modal) modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(modalId) {
    const ov = overlay();
    const modal = byId(modalId);
    if (modal) modal.hidden = true;

    // si no queda ningún modal abierto, cerramos overlay
    if (!anyModalOpen()) {
      if (ov) ov.hidden = true;
      document.body.classList.remove("modal-open");
    }
  }

  function closeAllModals() {
    document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
    const ov = overlay();
    if (ov) ov.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function bindCloseButtons() {
    // botones con data-close="modalId"
    document.querySelectorAll("[data-close]").forEach((btn) => {
      if (btn.dataset.boundClose) return;
      btn.dataset.boundClose = "1";
      btn.addEventListener("click", () => {
        const id = (btn.getAttribute("data-close") || "").trim();
        if (id) closeModal(id);
      });
    });
  }

  function bindOverlayClick() {
    const ov = overlay();
    if (!ov) return;
    if (ov.dataset.boundOverlay) return;
    ov.dataset.boundOverlay = "1";
    ov.addEventListener("click", () => closeAllModals());
  }

  function bindEscapeClose() {
    if (document.body.dataset.boundEsc) return;
    document.body.dataset.boundEsc = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && anyModalOpen()) closeAllModals();
    });
  }

  function initAll() {
    bindCloseButtons();
    bindOverlayClick();
    bindEscapeClose();
  }

  window.KP.adminUI.initAll = initAll;
  window.KP.adminUI.openModal = openModal;
  window.KP.adminUI.closeModal = closeModal;
  window.KP.adminUI.closeAllModals = closeAllModals;
})();
