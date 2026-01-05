(function () {
  window.KP = window.KP || {};
  window.KP.pedidos = window.KP.pedidos || {};

  // Este archivo NO contiene lógica pesada:
  // - Actúa como nexo/orquestador
  // - Deja que los submódulos registren funciones en window.KP.pedidos

  function ensure(fn, name) {
    if (typeof fn !== "function") {
      console.warn(`[KP] Falta implementación: ${name}()`);
    }
  }

  window.KP.pedidos.initAll = function () {
    ensure(window.KP.pedidos.initPedidosPage, "KP.pedidos.initPedidosPage");
    ensure(window.KP.pedidos.initPedidoModal, "KP.pedidos.initPedidoModal");
    ensure(window.KP.pedidos.initPedidoDetalleModal, "KP.pedidos.initPedidoDetalleModal");

    // Inicializaciones seguras (si el HTML no tiene el modal o la vista, no rompe)
    try { window.KP.pedidos.initPedidosPage && window.KP.pedidos.initPedidosPage(); } catch (e) { console.warn(e); }
    try { window.KP.pedidos.initPedidoModal && window.KP.pedidos.initPedidoModal(); } catch (e) { console.warn(e); }
    try { window.KP.pedidos.initPedidoDetalleModal && window.KP.pedidos.initPedidoDetalleModal(); } catch (e) { console.warn(e); }
  };
})();
