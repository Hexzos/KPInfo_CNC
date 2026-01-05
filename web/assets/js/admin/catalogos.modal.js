// web/assets/js/admin/catalogos.modal.js
(function () {
  window.KP = window.KP || {};
  window.KP.catalogosModal = window.KP.catalogosModal || {};

  const MODAL_ROOT_ID = "kpCatalogosModalRoot";
  const STYLE_ID = "kpCatalogosModalStyle";
  const OVERLAY_ID = "overlay";
  const OVERLAY_CLASS = "kp-catalogos-overlay";

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function ensureOverlay() {
    let ov = document.getElementById(OVERLAY_ID);
    if (!ov) {
      ov = document.createElement("div");
      ov.id = OVERLAY_ID;
      ov.className = "overlay";
      ov.hidden = true;
      document.body.appendChild(ov);
    }
    return ov;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* =========================
   Catálogos modal (inyectado)
   Estilos scopeados por ID
========================= */

#${OVERLAY_ID}.${OVERLAY_CLASS}{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 999;
}

#${MODAL_ROOT_ID}{
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
}

#${MODAL_ROOT_ID} .modal__card{
  width: min(720px, calc(100% - 48px));
  background: #fff;
  border-radius: 2px;
  border: 1px solid #bdbdbd;
  box-shadow: 0 18px 42px rgba(0,0,0,.22);
  padding: 24px 24px 18px 24px;
  position: relative;
}

#${MODAL_ROOT_ID} .kp-cat__close{
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: 1px solid #bdbdbd;
  background: #fff;
  border-radius: 2px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

#${MODAL_ROOT_ID} .kp-cat__title{
  margin: 0 0 6px 0;
  font-size: 18px;
  font-weight: 800;
}

#${MODAL_ROOT_ID} .kp-cat__desc{
  margin: 0 0 16px 0;
  font-size: 13px;
  color: #222;
  line-height: 1.35;
}

#${MODAL_ROOT_ID} .kp-cat__field label{
  display: block;
  font-weight: 800;
  font-size: 12px;
  margin-bottom: 6px;
}

#${MODAL_ROOT_ID} .kp-cat__field input{
  width: 100%;
  height: 36px;
  border: 1px solid #bdbdbd;
  border-radius: 2px;
  padding: 0 10px;
  outline: none;
}

#${MODAL_ROOT_ID} .kp-cat__field input:focus{
  border-color: #7a7a7a;
}

#${MODAL_ROOT_ID} .kp-cat__help{
  margin-top: 6px;
  font-size: 12px;
  color: #b00020;
  min-height: 16px;
}

#${MODAL_ROOT_ID} .kp-cat__actions{
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

#${MODAL_ROOT_ID} .kp-cat__actions .btn{
  min-width: 140px;
}
`;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (document.getElementById(MODAL_ROOT_ID)) return;

    const root = document.createElement("section");
    root.id = MODAL_ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "kpCatTitle");
    root.hidden = true;

    root.innerHTML = `
  <div class="modal__card">
    <button id="kpCatClose" class="kp-cat__close" aria-label="Cerrar">✖</button>

    <h2 id="kpCatTitle" class="kp-cat__title">Título</h2>
    <p id="kpCatDesc" class="kp-cat__desc">Descripción</p>

    <div id="kpCatField" class="kp-cat__field">
      <label for="kpCatInput" id="kpCatLabel">Nombre</label>
      <input id="kpCatInput" type="text" autocomplete="off" />
      <div id="kpCatErr" class="kp-cat__help"></div>
    </div>

    <div class="kp-cat__actions">
      <button id="kpCatCancel" class="btn btn--light" type="button">Cancelar</button>
      <button id="kpCatOk" class="btn btn--light" type="button">Aceptar</button>
    </div>
  </div>
`;
    document.body.appendChild(root);
  }

  function hasOtherModalOpen() {
    // Detecta modales existentes (los tuyos usan class="modal" + hidden)
    const open = Array.from(document.querySelectorAll(".modal")).some((m) => {
      if (!m || !(m instanceof HTMLElement)) return false;
      if (m.id === MODAL_ROOT_ID) return false;
      return m.hidden === false;
    });
    return open;
  }

  function openRoot() {
    const ov = ensureOverlay();
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    ov.classList.add(OVERLAY_CLASS);
    ov.hidden = false;
    modal.hidden = false;
  }

  function closeRoot() {
    const ov = ensureOverlay();
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    modal.hidden = true;

    if (!hasOtherModalOpen()) {
      ov.hidden = true;
      ov.classList.remove(OVERLAY_CLASS);
    } else {
      ov.classList.remove(OVERLAY_CLASS);
      ov.hidden = false;
    }
  }

  // -------------------------
  // Public: prompt
  // -------------------------
  window.KP.catalogosModal.prompt = function (opts = {}) {
    ensureStyles();
    ensureOverlay();
    ensureModal();

    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return Promise.resolve(null);

    const titleEl = qs("#kpCatTitle", modal);
    const descEl = qs("#kpCatDesc", modal);
    const field = qs("#kpCatField", modal);
    const labelEl = qs("#kpCatLabel", modal);
    const inputEl = qs("#kpCatInput", modal);
    const errEl = qs("#kpCatErr", modal);
    const btnOk = qs("#kpCatOk", modal);
    const btnCancel = qs("#kpCatCancel", modal);
    const btnClose = qs("#kpCatClose", modal);

    if (titleEl) titleEl.textContent = opts.title || "Nuevo registro";
    if (descEl) descEl.textContent = opts.message || "Ingrese nombre:";
    if (labelEl) labelEl.textContent = opts.label || "Nombre";
    if (btnOk) btnOk.textContent = opts.okText || "Aceptar";
    if (btnCancel) btnCancel.textContent = opts.cancelText || "Cancelar";

    if (field) field.hidden = false;
    if (errEl) errEl.textContent = "";
    if (inputEl) {
      inputEl.value = opts.defaultValue || "";
      inputEl.type = opts.type === "password" ? "password" : "text";
    }

    openRoot();

    // focus
    queueMicrotask(() => {
      inputEl?.focus?.();
      inputEl?.select?.();
    });

    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        cleanup();
        closeRoot();
        resolve(value);
      };

      const validate = () => {
        const raw = (inputEl?.value || "").trim();
        if (opts.required && !raw) {
          if (errEl) errEl.textContent = opts.requiredMsg || "Campo obligatorio.";
          inputEl?.focus?.();
          return null;
        }
        if (typeof opts.validate === "function") {
          const msg = opts.validate(raw);
          if (msg) {
            if (errEl) errEl.textContent = String(msg);
            inputEl?.focus?.();
            return null;
          }
        }
        return raw;
      };

      const onOk = () => {
        if (errEl) errEl.textContent = "";
        const v = validate();
        if (v === null) return;
        finish(v);
      };

      const onCancel = () => finish(null);

      const onKey = (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          onCancel();
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          onOk();
        }
      };

      const ov = document.getElementById(OVERLAY_ID);
      const onOverlay = () => {
        const m = document.getElementById(MODAL_ROOT_ID);
        if (m && !m.hidden) onCancel();
      };

      function cleanup() {
        btnOk?.removeEventListener("click", onOk);
        btnCancel?.removeEventListener("click", onCancel);
        btnClose?.removeEventListener("click", onCancel);
        inputEl?.removeEventListener("keydown", onKey);
        ov?.removeEventListener("click", onOverlay);
      }

      btnOk?.addEventListener("click", onOk);
      btnCancel?.addEventListener("click", onCancel);
      btnClose?.addEventListener("click", onCancel);
      inputEl?.addEventListener("keydown", onKey);
      ov?.addEventListener("click", onOverlay);
    });
  };

  // -------------------------
  // Public: confirm
  // -------------------------
  window.KP.catalogosModal.confirm = function (opts = {}) {
    ensureStyles();
    ensureOverlay();
    ensureModal();

    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return Promise.resolve(false);

    const titleEl = qs("#kpCatTitle", modal);
    const descEl = qs("#kpCatDesc", modal);
    const field = qs("#kpCatField", modal);
    const btnOk = qs("#kpCatOk", modal);
    const btnCancel = qs("#kpCatCancel", modal);
    const btnClose = qs("#kpCatClose", modal);

    if (titleEl) titleEl.textContent = opts.title || "Confirmación";
    if (descEl) descEl.textContent = opts.message || "¿Desea continuar?";
    if (btnOk) btnOk.textContent = opts.okText || "Aceptar";
    if (btnCancel) btnCancel.textContent = opts.cancelText || "Cancelar";

    // confirm no necesita input
    if (field) field.hidden = true;

    openRoot();

    // focus botón OK por defecto
    queueMicrotask(() => btnOk?.focus?.());

    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        cleanup();
        closeRoot();
        resolve(!!value);
      };

      const onOk = () => finish(true);
      const onCancel = () => finish(false);

      const onKey = (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          onCancel();
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          onOk();
        }
      };

      const ov = document.getElementById(OVERLAY_ID);
      const onOverlay = () => {
        const m = document.getElementById(MODAL_ROOT_ID);
        if (m && !m.hidden) onCancel();
      };

      function cleanup() {
        btnOk?.removeEventListener("click", onOk);
        btnCancel?.removeEventListener("click", onCancel);
        btnClose?.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        ov?.removeEventListener("click", onOverlay);
      }

      btnOk?.addEventListener("click", onOk);
      btnCancel?.addEventListener("click", onCancel);
      btnClose?.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
      ov?.addEventListener("click", onOverlay);
    });
  };
})();
