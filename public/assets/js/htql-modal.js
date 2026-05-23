/**
 * HTQL shared modals: open/close, body scroll lock, backdrop dismiss, header drag.
 */
(function () {
  var drag = null;

  function lockBody(on) {
    document.body.style.overflow = on ? "hidden" : "";
  }

  function resetPanel(panel) {
    if (!panel) return;
    panel.style.transform = "";
  }

  function parseTranslate(style) {
    var m = (style || "").match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  window.htqlOpenModal = function (id) {
    var backdrop = document.getElementById(id);
    if (!backdrop) return;
    var panel = backdrop.querySelector(".htql-modal-panel");
    resetPanel(panel);
    backdrop.classList.remove("hidden");
    lockBody(true);
  };

  window.htqlCloseModal = function (id) {
    var backdrop = document.getElementById(id);
    if (!backdrop) return;
    backdrop.classList.add("hidden");
    var panel = backdrop.querySelector(".htql-modal-panel");
    resetPanel(panel);
    if (!document.querySelector("[data-htql-modal]:not(.hidden)")) {
      lockBody(false);
    }
  };

  document.addEventListener("click", function (e) {
    var closeBtn = e.target.closest("[data-htql-modal-close]");
    if (closeBtn) {
      var backdrop = closeBtn.closest("[data-htql-modal]");
      if (backdrop && backdrop.id) {
        e.preventDefault();
        htqlCloseModal(backdrop.id);
      }
      return;
    }
    var backdrop = e.target.closest("[data-htql-modal]");
    if (backdrop && e.target === backdrop && backdrop.id) {
      htqlCloseModal(backdrop.id);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector("[data-htql-modal]:not(.hidden)");
    if (open && open.id) htqlCloseModal(open.id);
  });

  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    var handle = e.target.closest(".htql-modal-drag-handle");
    if (!handle) return;
    if (e.target.closest("[data-htql-modal-close], button, a, input, select, textarea, label")) return;
    var panel = handle.closest(".htql-modal-panel");
    var backdrop = handle.closest("[data-htql-modal]");
    if (!panel || !backdrop || backdrop.classList.contains("hidden")) return;
    e.preventDefault();
    var t = parseTranslate(panel.style.transform);
    drag = { panel: panel, startX: e.clientX, startY: e.clientY, ox: t.x, oy: t.y };
    handle.classList.add("htql-modal-dragging");
  });

  document.addEventListener("mousemove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;
    drag.panel.style.transform =
      "translate(" + (drag.ox + dx) + "px, " + (drag.oy + dy) + "px)";
  });

  document.addEventListener("mouseup", function () {
    if (!drag) return;
    var handle = drag.panel.querySelector(".htql-modal-drag-handle");
    if (handle) handle.classList.remove("htql-modal-dragging");
    drag = null;
  });
})();
