// web/assets/js/core.js
(function () {
  window.KP = window.KP || {};

  // =========================
  // Error estándar de la app
  // =========================
  class KPError extends Error {
    constructor(message, meta = {}) {
      super(message || "Error.");
      this.name = "KPError";
      this.code = meta.code || null;
      this.fields = meta.fields || null;
      this.status = meta.status || null;
      this.raw = meta.raw || null;
    }
  }

  function isJSONResponse(res) {
    const ct = res.headers.get("Content-Type") || "";
    return ct.includes("application/json");
  }

  async function readJSONSafe(res) {
    if (!isJSONResponse(res)) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  function pickServerErrorMessage(payload) {
    const msg = payload?.error?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    return null;
  }

  function normPath(p) {
    const s = String(p || "").toLowerCase();
    // quita query/hash si llegaran a colarse
    return s.split("?")[0].split("#")[0];
  }

  // =========================
  // Session (registro turno + extras + admin key)
  // =========================
  window.KP.Session = window.KP.Session || {
    // ----- Registro turno -----
    setRegistroTurno(payload) {
      sessionStorage.setItem("registro_turno", JSON.stringify(payload));
    },
    getRegistroTurno() {
      const raw = sessionStorage.getItem("registro_turno");
      return raw ? JSON.parse(raw) : null;
    },

    // ----- Admin key (panel admin) -----
    // Guardamos la clave SOLO si el backend responde rol=admin.
    setAdminKey(key) {
      if (key) sessionStorage.setItem("admin_key", String(key));
      else sessionStorage.removeItem("admin_key");
    },
    getAdminKey() {
      return sessionStorage.getItem("admin_key") || null;
    },
    clearAdminKey() {
      sessionStorage.removeItem("admin_key");
    },

    // ----- Extras mode -----
    setExtrasToken(token) {
      if (token) sessionStorage.setItem("extras_token", String(token));
      else sessionStorage.removeItem("extras_token");
    },
    getExtrasToken() {
      return sessionStorage.getItem("extras_token") || null;
    },
    setExtrasEnabled(enabled) {
      sessionStorage.setItem("extras_enabled", enabled ? "1" : "0");
    },
    isExtrasEnabled() {
      return sessionStorage.getItem("extras_enabled") === "1";
    },
    clearExtras() {
      sessionStorage.removeItem("extras_token");
      sessionStorage.removeItem("extras_enabled");
    },

    // ----- Legacy compat (temporal) -----
    setAdminToken(token) {
      this.setExtrasToken(token);
    },
    getAdminToken() {
      return this.getExtrasToken();
    },
    setAdminEnabled(enabled) {
      this.setExtrasEnabled(enabled);
    },
    isAdminEnabled() {
      return this.isExtrasEnabled();
    },
    clearAdmin() {
      this.clearExtras();
    },

    // ----- Clear total -----
    clear() {
      sessionStorage.removeItem("registro_turno");
      this.clearExtras();
      this.clearAdminKey();
    },
  };

  // =========================
  // API
  // =========================
  window.KP.API = window.KP.API || {
    async fetchJSON(url, opts = {}) {
      const baseHeaders = { "Content-Type": "application/json" };

      // Extras token headers
      const token = window.KP.Session.getExtrasToken();
      if (token) {
        baseHeaders["X-Extras-Token"] = token;
        baseHeaders["X-Admin-Token"] = token; // compat temporal
      }

      // Admin key header
      const adminKey = window.KP.Session.getAdminKey();
      if (adminKey) baseHeaders["X-Admin-Key"] = adminKey;

      const headers = { ...baseHeaders, ...(opts.headers || {}) };

      const res = await fetch(url, { ...opts, headers });
      const payload = await readJSONSafe(res);

      if (!res.ok) {
        const msg = pickServerErrorMessage(payload) || "Error de red.";
        throw new KPError(msg, {
          status: res.status,
          code: payload?.error?.code || null,
          fields: payload?.error?.fields || null,
          raw: payload,
        });
      }

      if (payload && payload.ok === false) {
        const msg = pickServerErrorMessage(payload) || "Solicitud inválida.";
        throw new KPError(msg, {
          status: res.status,
          code: payload?.error?.code || null,
          fields: payload?.error?.fields || null,
          raw: payload,
        });
      }

      return payload;
    },

    async fetchData(url, opts = {}) {
      const payload = await this.fetchJSON(url, opts);
      return payload?.data;
    },
  };

  // =========================
  // Utils
  // =========================
  window.KP.utils = window.KP.utils || {};

  window.KP.utils.debounce =
    window.KP.utils.debounce ||
    function (fn, wait = 250) {
      let t = null;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    };

  window.KP.utils.todayISO =
    window.KP.utils.todayISO ||
    function () {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

  // =========================
  // UI helpers
  // =========================
  window.KP.ui = window.KP.ui || {};

  window.KP.ui.setErrors =
    window.KP.ui.setErrors ||
    function (fields = {}) {
      document.querySelectorAll("[data-err]").forEach((el) => (el.textContent = ""));
      Object.entries(fields).forEach(([k, msg]) => {
        const el = document.querySelector(`[data-err="${k}"]`);
        if (el) el.textContent = msg;
      });
    };

  window.KP.ui.applyError =
    window.KP.ui.applyError ||
    function (err) {
      if (err && err.name === "KPError" && err.fields) {
        window.KP.ui.setErrors(err.fields);
      }
    };

  // =========================
  // KPINIT
  // =========================
  window.KPINIT = window.KPINIT || {};

  window.KPINIT.initLogin =
    window.KPINIT.initLogin ||
    function () {
      if (window.KP?.login?.initLogin) return window.KP.login.initLogin();
    };

  // Guard general
  window.KPINIT.guard =
    window.KPINIT.guard ||
    function () {
      const path = normPath(window.location.pathname || "");
      if (path === "/" || path.endsWith("/index.html")) return;

      const s = window.KP.Session.getRegistroTurno();
      if (!s?.registro_turno_id) window.location.href = "/index.html";
    };

  // Guard admin
  window.KPINIT.requireAdminPage =
    window.KPINIT.requireAdminPage ||
    function () {
      const s = window.KP.Session.getRegistroTurno();
      const k = window.KP.Session.getAdminKey();
      if (!s?.registro_turno_id || s?.rol !== "admin" || !k) {
        window.KP.Session.clear();
        window.location.href = "/index.html";
        return false;
      }
      return true;
    };

  // Navbar: rol + orden (Admin primero)
  window.KPINIT.applyRoleUI =
    window.KPINIT.applyRoleUI ||
    function () {
      const s = window.KP.Session.getRegistroTurno();
      const isAdmin = s?.rol === "admin";

      const navAdmin = document.getElementById("navAdmin");
      if (!navAdmin) return;

      navAdmin.hidden = !isAdmin;

      // Si está visible, debe quedar como primer link del nav.
      if (isAdmin) {
        const nav = navAdmin.closest(".sidebar__nav");
        if (nav && nav.firstElementChild !== navAdmin) {
          nav.insertBefore(navAdmin, nav.firstElementChild);
        }
      }
    };

  // Navbar: active state
  window.KPINIT.initNavActive =
    window.KPINIT.initNavActive ||
    function () {
      const path = normPath(window.location.pathname || "");

      // 1) rol + orden
      window.KPINIT.applyRoleUI();

      // 2) activo por coincidencia de href (endsWith)
      document.querySelectorAll(".sidebar__nav .navlink").forEach((a) => {
        const href = normPath(a.getAttribute("href") || "");
        const isActive = !!href && path.endsWith(href);
        a.classList.toggle("navlink--active", isActive);
      });
    };

  // Extras init
  window.KPINIT.initExtras =
    window.KPINIT.initExtras ||
    function () {
      if (window.KP?.extras?.initAll) window.KP.extras.initAll();
    };

  // Helpers defensivos (pedidos)
  window.KPINIT.initPedidosEmpty =
    window.KPINIT.initPedidosEmpty ||
    function () {
      if (window.KP?.pedidos?.initPedidosPage) window.KP.pedidos.initPedidosPage();
    };

  window.KPINIT.initPedidoModal =
    window.KPINIT.initPedidoModal ||
    function () {
      if (window.KP?.pedidos?.initPedidoModal) window.KP.pedidos.initPedidoModal();
    };

  window.KPINIT.initPedidoDetalleModal =
    window.KPINIT.initPedidoDetalleModal ||
    function () {
      if (window.KP?.pedidos?.initPedidoDetalleModal) window.KP.pedidos.initPedidoDetalleModal();
    };
})();
