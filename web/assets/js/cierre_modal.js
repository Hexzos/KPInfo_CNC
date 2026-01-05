// web/assets/js/cierre_modal.js
(function () {
  window.KP = window.KP || {};
  window.KP.cierre = window.KP.cierre || {};

  const MODAL_ROOT_ID = "kpCierreModalRoot";
  const STYLE_ID = "kpCierreModalStyle";
  const OVERLAY_ID = "overlay"; // reutiliza overlay global si existe
  const OVERLAY_CLASS = "kp-cierre-overlay"; // clase auxiliar para no pisar estilos globales

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

    // ⚠️ Importante: NO tocar .overlay ni .modal globales.
    style.textContent = `
/* =========================
   Cierre modal (inyectado)
   Estilos scopeados (NO global)
========================= */

/* Overlay solo cuando esté "marcado" por cierre_modal */
#${OVERLAY_ID}.${OVERLAY_CLASS}{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 999;
}

/* Modal cierre: id específico */
#${MODAL_ROOT_ID}{
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
}

#${MODAL_ROOT_ID} .modal__card{
  width: min(880px, calc(100% - 48px));
  min-height: 340px;
  background: #fff;
  border-radius: 2px;
  border: 1px solid #bdbdbd;
  box-shadow: 0 18px 42px rgba(0,0,0,.22);
  padding: 28px 28px 22px 28px;
  position: relative;
}

#${MODAL_ROOT_ID} .kp-cierre__close{
  position: absolute;
  top: 18px;
  right: 18px;
  width: 34px;
  height: 34px;
  border: 1px solid #bdbdbd;
  background: #fff;
  border-radius: 2px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

#${MODAL_ROOT_ID} .kp-cierre__title{
  margin: 0 0 18px 0;
  font-size: 22px;
  font-weight: 800;
}

#${MODAL_ROOT_ID} .kp-cierre__body{
  font-size: 13px;
  color: #222;
  margin: 0 0 18px 0;
}

#${MODAL_ROOT_ID} .kp-cierre__body ul{
  margin: 10px 0 12px 18px;
}

#${MODAL_ROOT_ID} .kp-cierre__question{
  margin-top: 18px;
  font-weight: 700;
}

#${MODAL_ROOT_ID} .kp-cierre__actions{
  display: flex;
  justify-content: center;
  gap: 28px;
  margin-top: 36px;
}

#${MODAL_ROOT_ID} .kp-cierre__actions .btn{
  min-width: 190px;
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
    root.setAttribute("aria-labelledby", "kpCierreTitle");
    root.hidden = true;

    root.innerHTML = `
  <div class="modal__card">
    <button id="kpCierreClose" class="kp-cierre__close" aria-label="Cerrar">✖</button>

    <h2 id="kpCierreTitle" class="kp-cierre__title">Cerrar sesión de registro</h2>

    <div class="kp-cierre__body">
      <div>Al cerrar la sesión:</div>
      <ul>
        <li>Todos los pedidos y anomalías con modificaciones pendientes se guardarán automáticamente.</li>
        <li>El modo administrador será desactivado.</li>
      </ul>
      <div class="kp-cierre__question">¿Desea continuar?</div>
    </div>

    <div class="kp-cierre__actions">
      <button id="kpCierreBack" class="btn btn--light" type="button">Volver</button>
      <button id="kpCierreAccept" class="btn btn--light" type="button">Aceptar</button>
    </div>
  </div>
`;
    document.body.appendChild(root);
  }

  function hasOtherModalOpen() {
    // Detecta modales existentes (los tuyos usan class="modal" y hidden)
    const open = Array.from(document.querySelectorAll(".modal")).some((m) => {
      // Si tu cierre modal ya no usa .modal, esto evita falsos positivos.
      if (!m || !(m instanceof HTMLElement)) return false;
      if (m.id === MODAL_ROOT_ID) return false;
      return m.hidden === false;
    });
    return open;
  }

  function openModal() {
    const ov = ensureOverlay();
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    ov.classList.add(OVERLAY_CLASS);
    ov.hidden = false;
    modal.hidden = false;

    qs("#kpCierreAccept", modal)?.focus?.();
  }

  function closeModal() {
    const ov = ensureOverlay();
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    modal.hidden = true;

    // Solo ocultar overlay si no hay otro modal abierto
    if (!hasOtherModalOpen()) {
      ov.hidden = true;
      ov.classList.remove(OVERLAY_CLASS);
    } else {
      // Si hay otro modal, solo quitamos la marca del cierre
      ov.classList.remove(OVERLAY_CLASS);
      ov.hidden = false;
    }
  }

  let _onAccept = null;

  async function accept() {
    try {
      const fn = _onAccept;
      _onAccept = null;

      if (typeof fn === "function") {
        await fn();
      } else {
        window.KP?.Session?.clear && window.KP.Session.clear();
        window.location.href = "/index.html";
      }
    } finally {
      closeModal();
    }
  }

  function initBindings() {
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    // Evitar doble bind
    if (modal.dataset.inited === "1") return;
    modal.dataset.inited = "1";

    qs("#kpCierreClose", modal)?.addEventListener("click", closeModal);
    qs("#kpCierreBack", modal)?.addEventListener("click", closeModal);
    qs("#kpCierreAccept", modal)?.addEventListener("click", accept);

    // Click overlay: solo cierra si el cierre está abierto
    const ov = document.getElementById(OVERLAY_ID);
    ov?.addEventListener("click", () => {
      const m = document.getElementById(MODAL_ROOT_ID);
      if (m && !m.hidden) closeModal();
    });

    // ESC cierra si está abierto
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      const m = document.getElementById(MODAL_ROOT_ID);
      if (m && !m.hidden) closeModal();
    });

    // ✅ Bind al botón Salir del registro (si existe en la página)
    const btnSalir = document.getElementById("btnSalir");
    if (btnSalir && btnSalir.dataset.kpCierreBound !== "1") {
      btnSalir.dataset.kpCierreBound = "1";
      btnSalir.addEventListener("click", () => {
        window.KP.cierre.open({
          onAccept: async () => {
            // En este MVP, “auto-guardado” ya queda como promesa del texto.
            // Aquí dejamos el comportamiento determinista:
            window.KP?.Session?.clear && window.KP.Session.clear();
            window.location.href = "/index.html";
          },
        });
      });
    }
  }

  window.KP.cierre.initAll = function () {
    ensureStyles();
    ensureOverlay();
    ensureModal();
    initBindings();
  };

  window.KP.cierre.open = function (opts = {}) {
    _onAccept = typeof opts.onAccept === "function" ? opts.onAccept : null;
    openModal();
  };

  window.KP.cierre.close = closeModal;
})();
