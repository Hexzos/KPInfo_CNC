// web/assets/js/extras.js
(function () {
  window.KP = window.KP || {};
  window.KP.extras = window.KP.extras || {};

  const MODAL_ROOT_ID = "kpExtrasModalRoot";
  const STYLE_ID = "kpExtrasStyle";
  const OVERLAY_ID = "overlay"; // reutiliza overlay global si existe
  const OVERLAY_CLASS = "kp-extras-overlay"; // para NO pisar estilos globales

  // Endpoint oficial
  const API_ELEVATE = "/api/extras/elevate";

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
   Extras modal (inyectado)
   Estilos scopeados por ID
========================= */

/* Overlay solo cuando esté "marcado" por extras */
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
  width: min(880px, calc(100% - 48px));
  min-height: 420px;
  background: #fff;
  border-radius: 2px;
  border: 1px solid #bdbdbd;
  box-shadow: 0 18px 42px rgba(0,0,0,.22);
  padding: 28px 28px 22px 28px;
  position: relative;
}

#${MODAL_ROOT_ID} .kp-extras__close{
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

#${MODAL_ROOT_ID} .kp-extras__title{
  margin: 0 0 8px 0;
  font-size: 26px;
  font-weight: 800;
}

#${MODAL_ROOT_ID} .kp-extras__desc{
  margin: 0 0 30px 0;
  font-size: 13px;
  color: #222;
}

#${MODAL_ROOT_ID} .kp-extras__row{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 18px 0;
}

#${MODAL_ROOT_ID} .kp-extras__label{
  font-weight: 800;
  font-size: 14px;
}

#${MODAL_ROOT_ID} .kp-extras__badge{
  display: inline-block;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  background: #d63636;
}

#${MODAL_ROOT_ID} .kp-extras__badge--on{
  background: #2ea043;
}

/* Switch simple */
#${MODAL_ROOT_ID} .kp-switch{
  width: 54px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid #bdbdbd;
  background: #fff;
  position: relative;
  cursor: pointer;
}
#${MODAL_ROOT_ID} .kp-switch[aria-checked="true"]{
  background: #111;
  border-color: #111;
}
#${MODAL_ROOT_ID} .kp-switch__knob{
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 3px;
  transition: left .15s ease;
  display: grid;
  place-items: center;
  font-size: 14px;
  line-height: 1;
}
#${MODAL_ROOT_ID} .kp-switch[aria-checked="true"] .kp-switch__knob{
  left: 28px;
}

#${MODAL_ROOT_ID} .kp-extras__auth{
  margin-top: 26px;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 18px;
  align-items: start;
}

#${MODAL_ROOT_ID} .kp-extras__auth label{
  font-weight: 800;
  font-size: 13px;
  margin-bottom: 8px;
  display: block;
}

#${MODAL_ROOT_ID} .kp-extras__auth input{
  width: 100%;
  height: 34px;
  border: 1px solid #bdbdbd;
  border-radius: 2px;
  padding: 0 10px;
  outline: none;
}

#${MODAL_ROOT_ID} .kp-extras__auth input:focus{
  border-color: #7a7a7a;
}

#${MODAL_ROOT_ID} .kp-extras__auth .help{
  margin-top: 6px;
  font-size: 12px;
  color: #b00020;
  min-height: 16px;
}

#${MODAL_ROOT_ID} .kp-extras__actions{
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

#${MODAL_ROOT_ID} .kp-extras__actions .btn{
  min-width: 210px;
}
`;
    document.head.appendChild(style);
  }

  function isExtrasActive() {
    return !!window.KP?.Session?.getExtrasToken?.();
  }

  function setGearState(active) {
    const btn = document.getElementById("btnExtras");
    if (!btn) return;
    btn.classList.toggle("iconbtn--extras-active", !!active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function ensureModal() {
    if (document.getElementById(MODAL_ROOT_ID)) return;

    const root = document.createElement("section");
    root.id = MODAL_ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "kpExtrasTitle");
    root.hidden = true;

    root.innerHTML = `
  <div class="modal__card">
    <button id="kpExtrasClose" class="kp-extras__close" aria-label="Cerrar">✖</button>

    <h2 id="kpExtrasTitle" class="kp-extras__title">Opciones extras</h2>
    <p class="kp-extras__desc">Esta capa habilita funciones adicionales y acciones sensibles cuando esté activa.</p>

    <div class="kp-extras__row">
      <div>
        <div class="kp-extras__label">Estado actual</div>
      </div>
      <div>
        <span id="kpExtrasBadge" class="kp-extras__badge">Desactivado</span>
      </div>
    </div>

    <div class="kp-extras__row">
      <div class="kp-extras__label">Activar opciones extras</div>

      <button
        id="kpExtrasSwitch"
        class="kp-switch"
        type="button"
        role="switch"
        aria-checked="false"
        aria-label="Activar opciones extras"
      >
        <span class="kp-switch__knob" aria-hidden="true">✓</span>
      </button>
    </div>

    <div id="kpExtrasAuth" class="kp-extras__auth" hidden>
      <div>
        <div class="kp-extras__label" style="margin-bottom:8px;">Ingrese clave para habilitar</div>
      </div>

      <div>
        <label for="kpExtrasKey" style="position:absolute; left:-9999px;">Clave</label>
        <input id="kpExtrasKey" type="password" placeholder="Clave de habilitación" autocomplete="current-password" />
        <div id="kpExtrasErr" class="help"></div>

        <div class="kp-extras__actions">
          <button id="kpExtrasConfirm" class="btn btn--light" type="button">Confirmar activación</button>
        </div>
      </div>
    </div>
  </div>
`;
    document.body.appendChild(root);
  }

  function hasOtherModalOpen() {
    const open = Array.from(document.querySelectorAll(".modal")).some((m) => {
      if (!m || !(m instanceof HTMLElement)) return false;
      if (m.id === MODAL_ROOT_ID) return false;
      return m.hidden === false;
    });
    return open;
  }

  // ✅ Fuente de verdad: token extras
  function syncUI() {
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    const active = isExtrasActive();

    const badge = qs("#kpExtrasBadge", modal);
    if (badge) {
      badge.textContent = active ? "Activado" : "Desactivado";
      badge.classList.toggle("kp-extras__badge--on", active);
    }

    // ✅ FIX: si NO hay token, el switch debe quedar siempre apagado (no conservar estado previo)
    const sw = qs("#kpExtrasSwitch", modal);
    if (sw) sw.setAttribute("aria-checked", active ? "true" : "false");

    const auth = qs("#kpExtrasAuth", modal);
    if (auth) auth.hidden = active; // si está activo, no pedir clave

    const err = qs("#kpExtrasErr", modal);
    if (err && active) err.textContent = "";

    setGearState(active);
  }

  function openModal() {
    const ov = ensureOverlay();
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    ov.classList.add(OVERLAY_CLASS);
    ov.hidden = false;
    modal.hidden = false;

    // ✅ Siempre sincronizar al abrir
    syncUI();

    // Si está inactivo, mostrar auth y enfocar input
    const active = isExtrasActive();
    const auth = qs("#kpExtrasAuth", modal);
    const key = qs("#kpExtrasKey", modal);
    if (!active && auth) auth.hidden = false;
    if (!active && key) key.focus();
  }

  function closeModal() {
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

  async function postElevate(body) {
    return await window.KP.API.fetchJSON(API_ELEVATE, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async function confirmActivate() {
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    const err = qs("#kpExtrasErr", modal);
    const key = qs("#kpExtrasKey", modal);
    const btn = qs("#kpExtrasConfirm", modal);

    if (err) err.textContent = "";

    const s = window.KP?.Session?.getRegistroTurno?.();
    const rid = s?.registro_turno_id;

    const extras_key = (key?.value || "").trim();
    if (!extras_key) {
      if (err) err.textContent = "Ingrese la clave.";
      key?.focus?.();
      return;
    }
    if (!rid) {
      if (err) err.textContent = "Sesión inválida. Reinicie el registro.";
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const payload = await postElevate({ registro_turno_id: rid, extras_key });

      const token = payload?.data?.token;
      if (!token) throw new Error("Respuesta inválida del servidor.");

      window.KP.Session.setExtrasToken(token);
      window.KP.Session.setExtrasEnabled(true);

      if (key) key.value = "";

      // ✅ FIX: reflejar estado real
      syncUI();
    } catch (e) {
      const msg = e?.message || "Clave incorrecta, intente nuevamente.";
      if (err) err.textContent = msg;

      // ✅ FIX: si falla, dejar todo apagado/limpio
      window.KP.Session.clearExtras?.();
      if (key) key.value = "";

      syncUI();

      const auth = qs("#kpExtrasAuth", modal);
      if (auth) auth.hidden = false;

      key?.focus?.();
      key?.select?.();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function toggleSwitch() {
    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    const sw = qs("#kpExtrasSwitch", modal);
    if (!sw) return;

    const active = isExtrasActive();

    // Si está activo => apagar limpia token y UI
    if (active) {
      window.KP.Session.clearExtras?.();
      syncUI();
      return;
    }

    // Si está inactivo => mostrar auth (pero NO marcar como activo aún)
    sw.setAttribute("aria-checked", "true"); // visual de “quiero activar”
    const auth = qs("#kpExtrasAuth", modal);
    const err = qs("#kpExtrasErr", modal);
    const key = qs("#kpExtrasKey", modal);

    if (auth) auth.hidden = false;
    if (err) err.textContent = "";
    key?.focus?.();
  }

  window.KP.extras.initAll = function () {
    ensureStyles();
    ensureOverlay();
    ensureModal();

    const btnExtras = document.getElementById("btnExtras");
    if (btnExtras) {
      btnExtras.addEventListener("click", () => openModal());
      setGearState(isExtrasActive());
    }

    const modal = document.getElementById(MODAL_ROOT_ID);
    if (!modal) return;

    qs("#kpExtrasClose", modal)?.addEventListener("click", closeModal);

    const ov = document.getElementById(OVERLAY_ID);
    ov?.addEventListener("click", () => {
      const m = document.getElementById(MODAL_ROOT_ID);
      if (m && !m.hidden) closeModal();
    });

    qs("#kpExtrasSwitch", modal)?.addEventListener("click", toggleSwitch);
    qs("#kpExtrasConfirm", modal)?.addEventListener("click", confirmActivate);

    qs("#kpExtrasKey", modal)?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        confirmActivate();
      }
    });

    // ✅ Sincronizar en init
    syncUI();
  };
})();
