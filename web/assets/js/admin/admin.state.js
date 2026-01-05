// web/assets/js/admin/admin.state.js
(function () {
  window.KP = window.KP || {};
  window.KP.adminState = window.KP.adminState || {};

  function setMsg(id, text, kind = "") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("msg--ok", "msg--err");
    if (kind === "ok") el.classList.add("msg--ok");
    if (kind === "err") el.classList.add("msg--err");
  }

  function escHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normNombre(s) {
    return String(s ?? "").trim();
  }

  const State = {
    catalogos: {
      tipos_plancha: [],
      variaciones: [],
      turnos: [],
      maquinas: [],
    },
  };

  window.KP.adminState.setMsg = setMsg;
  window.KP.adminState.escHtml = escHtml;
  window.KP.adminState.normNombre = normNombre;
  window.KP.adminState.State = State;
})();
