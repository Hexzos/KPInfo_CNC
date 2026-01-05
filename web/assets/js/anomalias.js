// web/assets/js/anomalias.js
(function () {
  window.KP = window.KP || {};
  window.KP.anomalias = window.KP.anomalias || {};
  window.KPREFRESH = window.KPREFRESH || {};

  function safeText(el, txt) {
    if (el) el.textContent = txt || "";
  }

  function bindSalir() {
    const btnSalir = document.getElementById("btnSalir");
    if (!btnSalir) return;

    // Evitar doble bind si initAll se llama más de una vez
    if (btnSalir.dataset.bound === "1") return;
    btnSalir.dataset.bound = "1";

    btnSalir.addEventListener("click", () => {
      // Si está disponible el modal inyectable, úsalo
      if (window.KP?.cierre?.open) {
        window.KP.cierre.open({
          onAccept: async () => {
            // Limpieza sesión + volver al login
            window.KP?.Session?.clear && window.KP.Session.clear();
            window.location.href = "/index.html";
          },
        });
        return;
      }

      // Fallback: confirm nativo (por si cierre_modal.js no cargó)
      const ok = confirm("¿Salir del registro?");
      if (ok) {
        window.KP?.Session?.clear && window.KP.Session.clear();
        window.location.href = "/index.html";
      }
    });
  }

  window.KP.anomalias.initAll = function () {
    // UI: mostrar contexto de sesión
    const s = window.KP.Session.getRegistroTurno();
    const sessionInfo = document.getElementById("sessionInfo");
    if (s?.registro_turno_id) {
      safeText(sessionInfo, `${s.operador_nombre} ${s.operador_apellido} · ${s.fecha || "—"}`);
    } else {
      safeText(sessionInfo, "Sesión no iniciada");
    }

    // ✅ Cierre de sesión (inyectable)
    window.KP?.cierre?.initAll && window.KP.cierre.initAll();
    bindSalir();

    // Init módulos
    window.KP.anomalias.initAnomaliasPage && window.KP.anomalias.initAnomaliasPage();
    window.KP.anomalias.initCrearModal && window.KP.anomalias.initCrearModal();
    window.KP.anomalias.initDetalleModal && window.KP.anomalias.initDetalleModal();

    // Refresh global
    window.KPREFRESH.refreshAnomalias = window.KPREFRESH.refreshAnomalias || (async function () {
      if (window.KP.anomalias.refreshList) return window.KP.anomalias.refreshList();
    });

    // Un primer load
    if (window.KPREFRESH.refreshAnomalias) window.KPREFRESH.refreshAnomalias();
  };
})();
