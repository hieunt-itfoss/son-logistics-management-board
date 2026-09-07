/**
 * Searchable combobox — type in the text field, pick from filtered dropdown.
 * Markup from searchSelect() in src/utils/ui.ts — TailwindAdmin utilities:
 * combobox-trigger, combobox-menu, combobox-item, combobox-empty
 */
(function () {
  function khongDau(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "L")
      .toLowerCase();
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return escHtml(s).replace(/'/g, "&#39;");
  }

  function parseOptions(wrap) {
    try {
      return JSON.parse(wrap.dataset.options || "[]");
    } catch (e) {
      return [];
    }
  }

  function normalize(options) {
    return options.map(function (o) {
      return {
        value: String(o.value ?? ""),
        label: String(o.label ?? o.value ?? ""),
        data: o.data || {},
        n: khongDau(String(o.label ?? o.value ?? "")),
      };
    });
  }

  function applyDataAttrs(hidden, data) {
    Array.from(hidden.attributes).forEach(function (attr) {
      if (attr.name.indexOf("data-") === 0 && attr.name !== "data-htql-bound") {
        hidden.removeAttribute(attr.name);
      }
    });
    if (!data) return;
    Object.keys(data).forEach(function (k) {
      if (data[k] != null && data[k] !== "") {
        hidden.setAttribute("data-" + k, String(data[k]));
      }
    });
  }

  function bindCombobox(wrap) {
    if (wrap.dataset.htqlBound) return;
    wrap.dataset.htqlBound = "1";

    var input = wrap.querySelector('input[type="text"]');
    var hidden = wrap.querySelector('input[type="hidden"]');
    var list = wrap.querySelector(".combobox-menu, .htql-combobox-list");
    if (!input || !hidden || !list) return;

    var normalized = normalize(parseOptions(wrap));
    wrap._htqlNormalized = normalized;

    var committed = { value: "", label: "", data: {} };

    function openList() {
      input.setAttribute("aria-expanded", "true");
      list.classList.remove("hidden");
    }

    function closeList() {
      input.setAttribute("aria-expanded", "false");
      list.classList.add("hidden");
    }

    function renderList(filter) {
      var n = khongDau(filter);
      var matches = normalized.filter(function (o) {
        return !n || o.n.indexOf(n) !== -1 || String(o.value).toLowerCase().indexOf(n) !== -1;
      });
      if (matches.length === 0) {
        list.innerHTML =
          '<li class="combobox-empty" role="presentation">Không tìm thấy</li>';
      } else {
        list.innerHTML = matches
          .map(function (o) {
            var active =
              hidden.value !== "" && o.value === hidden.value
                ? " combobox-item-active"
                : "";
            return (
              '<li class="combobox-item' +
              active +
              '" role="option" data-value="' +
              escAttr(o.value) +
              '" tabindex="-1">' +
              escHtml(o.label) +
              "</li>"
            );
          })
          .join("");
      }
      openList();
    }

    function selectOption(value, label, data, silent) {
      hidden.value = value;
      input.value = label;
      applyDataAttrs(hidden, data);
      committed = { value: value, label: label, data: data || {} };
      closeList();
      if (!silent) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function findByValue(value) {
      for (var i = 0; i < normalized.length; i++) {
        if (normalized[i].value === value) return normalized[i];
      }
      return null;
    }

    function findByLabel(label) {
      var typed = (label || "").trim();
      if (!typed) return null;
      var n = khongDau(typed);
      for (var i = 0; i < normalized.length; i++) {
        if (normalized[i].label === typed || normalized[i].n === n) return normalized[i];
      }
      return null;
    }

    /** After typing/filter, commit a real selection or restore the last one. */
    function settleSelection() {
      if (hidden.value !== "") {
        var cur = findByValue(hidden.value);
        if (cur) {
          input.value = cur.label;
          committed = { value: cur.value, label: cur.label, data: cur.data || {} };
        }
        return;
      }
      var typed = input.value.trim();
      if (!typed) {
        committed = { value: "", label: "", data: {} };
        applyDataAttrs(hidden, {});
        return;
      }
      var match = findByLabel(typed);
      if (match) {
        selectOption(match.value, match.label, match.data);
        return;
      }
      if (committed.value) {
        selectOption(committed.value, committed.label, committed.data, true);
      } else {
        input.value = "";
        applyDataAttrs(hidden, {});
      }
    }

    wrap._htqlSelect = function (value) {
      var o = findByValue(value);
      if (o) selectOption(o.value, o.label, o.data);
      else {
        hidden.value = value || "";
        input.value = "";
        applyDataAttrs(hidden, {});
        committed = { value: hidden.value, label: "", data: {} };
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    wrap._htqlAdd = function (opt) {
      var o = {
        value: String(opt.value ?? ""),
        label: String(opt.label ?? opt.value ?? ""),
        data: opt.data || {},
        n: khongDau(String(opt.label ?? opt.value ?? "")),
      };
      normalized = normalized.filter(function (x) {
        return x.value !== o.value;
      });
      normalized.push(o);
      wrap._htqlNormalized = normalized;
      wrap.dataset.options = JSON.stringify(
        normalized.map(function (x) {
          return { value: x.value, label: x.label, data: x.data };
        }),
      );
      selectOption(o.value, o.label, o.data);
    };

    if (hidden.value) {
      var init = findByValue(hidden.value);
      if (init) {
        applyDataAttrs(hidden, init.data);
        committed = { value: init.value, label: init.label || input.value, data: init.data || {} };
        if (!input.value) input.value = init.label;
      } else {
        committed = { value: hidden.value, label: input.value, data: {} };
      }
    }

    input.addEventListener("input", function () {
      hidden.value = "";
      applyDataAttrs(hidden, {});
      renderList(input.value);
    });

    // Click/focus opens the full list (not filtered by current label).
    // Typing still filters via the input handler above.
    function openAllOptions() {
      renderList("");
    }

    input.addEventListener("focus", function () {
      openAllOptions();
      try {
        input.select();
      } catch (e) {
        /* ignore — some browsers block select() on certain inputs */
      }
    });

    input.addEventListener("click", function () {
      openAllOptions();
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (wrap.contains(document.activeElement)) return;
        settleSelection();
        closeList();
      }, 120);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (committed.value) {
          selectOption(committed.value, committed.label, committed.data, true);
        } else {
          input.value = "";
          hidden.value = "";
          applyDataAttrs(hidden, {});
        }
        closeList();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        var first = list.querySelector(".combobox-item");
        if (first) {
          var o = findByValue(first.dataset.value);
          selectOption(first.dataset.value, first.textContent.trim(), o && o.data);
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (list.classList.contains("hidden")) openAllOptions();
        var firstItem = list.querySelector(".combobox-item");
        if (firstItem) firstItem.focus();
      }
    });

    list.addEventListener("mousedown", function (e) {
      var item = e.target.closest(".combobox-item");
      if (item) {
        e.preventDefault();
        var o = findByValue(item.dataset.value);
        selectOption(item.dataset.value, item.textContent.trim(), o && o.data);
      }
    });

    list.addEventListener("keydown", function (e) {
      var item = e.target.closest(".combobox-item");
      if (!item) return;
      if (e.key === "Enter") {
        e.preventDefault();
        var o = findByValue(item.dataset.value);
        selectOption(item.dataset.value, item.textContent.trim(), o && o.data);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = item.nextElementSibling;
        if (next && next.classList.contains("combobox-item")) next.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = item.previousElementSibling;
        if (prev && prev.classList.contains("combobox-item")) {
          prev.focus();
        } else {
          input.focus();
        }
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) closeList();
    });
  }

  window.htqlInitComboboxes = function (root) {
    (root || document)
      .querySelectorAll("[data-htql-combobox]")
      .forEach(bindCombobox);
  };

  window.htqlComboboxSet = function (id, value) {
    var wrap = document.querySelector('[data-htql-combobox][data-id="' + id + '"]');
    if (wrap && wrap._htqlSelect) wrap._htqlSelect(value);
  };

  window.htqlComboboxAdd = function (id, option) {
    var wrap = document.querySelector('[data-htql-combobox][data-id="' + id + '"]');
    if (wrap && wrap._htqlAdd) wrap._htqlAdd(option);
  };

  window.htqlComboboxGet = function (id) {
    var wrap = document.querySelector('[data-htql-combobox][data-id="' + id + '"]');
    if (!wrap) return null;
    var hidden = wrap.querySelector('input[type="hidden"]');
    if (!hidden) return null;
    var opts = wrap._htqlNormalized || normalize(parseOptions(wrap));
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value === hidden.value) {
        return { value: opts[i].value, label: opts[i].label, data: opts[i].data || {} };
      }
    }
    return { value: hidden.value, label: "", data: {} };
  };

  /** Build combobox HTML client-side (dynamic rows). Call htqlInitComboboxes after insert. */
  window.htqlComboboxHtml = function (opts) {
    var id = opts.id || opts.name;
    var name = opts.name;
    var ph = opts.placeholder || "Gõ để tìm...";
    var options = opts.options || [];
    if (opts.emptyLabel != null) {
      options = [{ value: "", label: opts.emptyLabel }].concat(options);
    }
    var selected = opts.value
      ? options.find(function (o) {
          return String(o.value) === String(opts.value);
        })
      : null;
    var inputVal = selected ? escAttr(selected.label) : "";
    var hiddenVal = selected ? escAttr(selected.value) : "";
    var req = opts.required ? ' data-required="true"' : "";
    var onchange = opts.onchange
      ? ' onchange="' + escAttr(opts.onchange) + '"'
      : "";
    var wrapCls =
      "htql-combobox relative" +
      (opts.class && /\b(w-|min-w-|max-w-|shrink-)/.test(opts.class)
        ? ""
        : " w-full min-w-0") +
      (opts.class ? " " + opts.class : "");
    return (
      '<div class="' +
      wrapCls +
      '" data-htql-combobox data-id="' +
      escAttr(id) +
      '" data-name="' +
      escAttr(name) +
      '" data-options="' +
      escAttr(JSON.stringify(options)) +
      '"' +
      req +
      ' data-placeholder="' +
      escAttr(ph) +
      '">' +
      '<div class="relative">' +
      '<input type="text" id="' +
      escAttr(id) +
      '_input" class="combobox-trigger" placeholder="' +
      escAttr(ph) +
      '" autocomplete="off" value="' +
      inputVal +
      '" role="combobox" aria-expanded="false">' +
      '<iconify-icon icon="solar:alt-arrow-down-linear" class="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-bodytext dark:text-darklink text-lg" aria-hidden="true"></iconify-icon>' +
      "</div>" +
      '<input type="hidden" name="' +
      escAttr(name) +
      '" id="' +
      escAttr(id) +
      '" value="' +
      hiddenVal +
      '"' +
      onchange +
      ">" +
      '<ul id="' +
      escAttr(id) +
      '_list" class="combobox-menu hidden" role="listbox"></ul>' +
      "</div>"
    );
  };

  document.addEventListener("DOMContentLoaded", function () {
    htqlInitComboboxes();
  });
})();
