// web/assets/js/login.js
(function () {
  window.KP = window.KP || {};
  window.KP.login = window.KP.login || {};

  // =========================
  // Reglas "simples" (hardcode)
  // =========================
  const ADMIN_NOMBRE = "admin";
  const ADMIN_APELLIDO = "cnc";

  // Credenciales admin backend (config.py)
  const ADMIN_USERNAME = "admin";
  const ADMIN_KEY = "AdminPanel.2026";

  // Password admin (la escribe el usuario en "clave")
  // Perfil esperado: admin/cnc/adminCNC.1234

  // Extras: admin debe activarlo por defecto
  const EXTRAS_KEY = "operadorCNC.1234";
  const EXTRAS_ELEVATE_ENDPOINT = "/api/extras/elevate";

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function setMsg(text, isErr = false) {
    const msg = document.getElementById("msg");
    if (!msg) return;
    msg.style.color = isErr ? "#b00020" : "";
    msg.textContent = text || "";
  }

  async function elevateExtras(registro_turno_id) {
    // si ya hay token, no repetir
    if (window.KP?.Session?.getExtrasToken?.()) return;

    const payload = await window.KP.API.fetchJSON(EXTRAS_ELEVATE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ registro_turno_id, extras_key: EXTRAS_KEY }),
    });

    const token = payload?.data?.token;
    if (token) {
      window.KP.Session.setExtrasToken(token);
      window.KP.Session.setExtrasEnabled(true);
    }
  }

  window.KP.login.initLogin = function () {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setMsg("");

      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      const nombreEl = document.getElementById("nombre");
      const apellidoEl = document.getElementById("apellido");
      const claveEl = document.getElementById("clave");

      const operador_nombre = (nombreEl?.value || "").trim();
      const operador_apellido = (apellidoEl?.value || "").trim();
      const clave = (claveEl?.value || "").trim();

      if (operador_nombre.length < 2 || operador_apellido.length < 2) {
        setMsg("Nombre y apellido deben tener al menos 2 caracteres.", true);
        if (btn) btn.disabled = false;
        return;
      }
      if (!clave) {
        setMsg("Ingrese la clave.", true);
        if (btn) btn.disabled = false;
        return;
      }

      const isAdminAttempt =
        norm(operador_nombre) === ADMIN_NOMBRE &&
        norm(operador_apellido) === ADMIN_APELLIDO;

      // Payload base
      const body = { operador_nombre, operador_apellido };

      // Si coincide "admin/cnc", interpretamos el input "clave" como contraseña admin
      if (isAdminAttempt) {
        body.admin_username = ADMIN_USERNAME;
        body.admin_password = clave;
        body.admin_key = ADMIN_KEY;
      }

      try {
        setMsg("Iniciando sesión…");

        const res = await window.KP.API.fetchJSON("/api/registro-turno/iniciar", {
          method: "POST",
          body: JSON.stringify(body),
        });

        const data = res?.data || {};
        const rol = data.rol || (isAdminAttempt ? "admin" : "operador");
        const rid = data.registro_turno_id;

        if (!rid) {
          setMsg("Respuesta inválida del servidor (sin registro_turno_id).", true);
          return;
        }

        // Guardar sesión base
        window.KP.Session.setRegistroTurno({
          registro_turno_id: rid,
          operador_nombre,
          operador_apellido,
          fecha: data.fecha,
          rol,
        });

        if (rol === "admin") {
          // Guardar admin key para endpoints /api/admin/*
          const adminKey = data.admin_key || ADMIN_KEY;
          window.KP.Session.setAdminKey && window.KP.Session.setAdminKey(adminKey);

          // Activar extras por defecto
          try {
            await elevateExtras(rid);
            setMsg("Administrador activo. Opciones extras habilitadas por defecto.");
          } catch (e) {
            // no bloquea el acceso admin
            setMsg("Administrador activo. No fue posible habilitar extras automáticamente.", true);
          }

          window.location.href = "/admin.html";
          return;
        }

        // Operador: limpiar residuos por seguridad
        window.KP.Session.clearAdminKey && window.KP.Session.clearAdminKey();
        window.KP.Session.clearExtras && window.KP.Session.clearExtras();

        setMsg("");
        window.location.href = "/pedidos.html";
      } catch (e) {
        setMsg(e?.message || "No fue posible iniciar el registro.", true);
      } finally {
        // limpiar clave (no queda en DOM)
        if (claveEl) claveEl.value = "";
        if (btn) btn.disabled = false;
      }
    });
  };
})();
