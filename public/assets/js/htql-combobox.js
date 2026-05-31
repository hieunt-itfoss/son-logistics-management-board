/**
 * Searchable combobox — type in the text field, pick from filtered dropdown.
 * Markup from searchSelect() in src/utils/ui.ts
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

  function bindCombobox(wrap) {
    if (wrap.dataset.htqlBound) return;
    wrap.dataset.htqlBound = "1";

    var options = JSON.parse(wrap.dataset.options || "[]");
    var input = wrap.querySelector('input[type="text"]');
    var hidden = wrap.querySelector('input[type="hidden"]');
    var list = wrap.querySelector(".htql-combobox-list");
    if (!input || !hidden || !list) return;

    var normalized = options.map(function (o) {
      return { value: o.value, label: o.label, n: khongDau(o.label) };
    });

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
        return !n || o.n.indexOf(n) !== -1;
      });
      if (matches.length === 0) {
        list.innerHTML =
          '<li class="htql-combobox-empty" role="presentation">Không tìm thấy</li>';
      } else {
        list.innerHTML = matches
          .map(function (o) {
            return (
              '<li class="htql-combobox-item" role="option" data-value="' +
              escHtml(o.value) +
              '" tabindex="-1">' +
              escHtml(o.label) +
              "</li>"
            );
          })
          .join("");
      }
      openList();
    }

    function selectOption(value, label) {
      hidden.value = value;
      input.value = label;
      closeList();
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }

    input.addEventListener("input", function () {
      hidden.value = "";
      renderList(input.value);
    });

    input.addEventListener("focus", function () {
      renderList(input.value);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeList();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        var first = list.querySelector(".htql-combobox-item");
        if (first) {
          selectOption(first.dataset.value, first.textContent.trim());
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var first = list.querySelector(".htql-combobox-item");
        if (first) first.focus();
      }
    });

    list.addEventListener("mousedown", function (e) {
      var item = e.target.closest(".htql-combobox-item");
      if (item) {
        e.preventDefault();
        selectOption(item.dataset.value, item.textContent.trim());
      }
    });

    list.addEventListener("keydown", function (e) {
      var item = e.target.closest(".htql-combobox-item");
      if (!item) return;
      if (e.key === "Enter") {
        e.preventDefault();
        selectOption(item.dataset.value, item.textContent.trim());
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = item.nextElementSibling;
        if (next && next.classList.contains("htql-combobox-item")) next.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = item.previousElementSibling;
        if (prev && prev.classList.contains("htql-combobox-item")) {
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

  document.addEventListener("DOMContentLoaded", function () {
    htqlInitComboboxes();
  });
})();
