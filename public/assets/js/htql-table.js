/**
 * HTQL DataTable: client-side sorting, column resizing, debounced search.
 * Each .htql-dt[data-htql-dt] gets its own instance.
 */
(function () {
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    document.querySelectorAll(".htql-dt[data-htql-dt]").forEach(setupTable);
    document.querySelectorAll(".htql-search-input[data-auto-width]").forEach(autoWidthInput);
    document.querySelectorAll(".htql-search-input[data-auto-search]").forEach(setupAutoSearch);
  }
  function setupAutoSearch(input) {
    var form = input.closest("form");
    if (!form) return;
    var timer = null;
    var lastSubmitted = input.value;

    function submitSearch() {
      if (input.value === lastSubmitted) return;
      lastSubmitted = input.value;
      form.classList.add("htql-search-pending");
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
    }

    input.addEventListener("input", function () {
      clearTimeout(timer);
      var delay = input.value === "" ? 0 : 350;
      timer = setTimeout(submitSearch, delay);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        clearTimeout(timer);
        e.preventDefault();
        submitSearch();
      }
    });
  }

  function autoWidthInput(input) {
    var ph = input.getAttribute("placeholder") || "";
    var ch = Math.max(ph.length, 8);
    input.style.width = (ch + 4) + "ch";
  }

  function setupTable(root) {
    var table = root.querySelector("table");
    if (!table) return;

    var headerRow = table.querySelector("thead tr.htql-dt-header-row");
    if (!headerRow) return;

    var ths = Array.from(headerRow.querySelectorAll("th"));
    var tbody = table.querySelector("tbody");
    if (!tbody) return;

    var allRows = Array.from(tbody.querySelectorAll("tr:not(.htql-dt-totals)"));
    var groupRows = [];
    var dataRows = [];
    allRows.forEach(function (tr) {
      if (tr.classList.contains("htql-dt-group-row")) {
        groupRows.push(tr);
      } else {
        dataRows.push(tr);
      }
    });

    var sortCol = -1;
    var sortDir = 0;

    ths.forEach(function (th, colIdx) {
      if (th.classList.contains("htql-dt-sortable")) {
        th.addEventListener("click", function (e) {
          if (e.target.closest(".htql-dt-resize")) return;
          if (sortCol === colIdx) {
            sortDir = sortDir === 1 ? -1 : sortDir === -1 ? 0 : 1;
          } else {
            sortCol = colIdx;
            sortDir = 1;
          }
          updateSortIcons(ths, sortCol, sortDir);
          applySort(tbody, dataRows, groupRows, sortCol, sortDir);
        });
      }

      setupResize(th, table);
    });

    setupGroupToggle(table);
  }

  /* ── Group row expand/collapse (client-side, no page reload) ── */
  function setupGroupToggle(table) {
    table.querySelectorAll(".htql-dt-group-row").forEach(function (groupRow) {
      var groupId = groupRow.getAttribute("data-group-id");
      if (!groupId) return;

      function childRows() {
        return Array.from(table.querySelectorAll('tr.lo-row[data-group="' + groupId + '"]'));
      }

      function isCollapsed() {
        return groupRow.getAttribute("data-collapsed") === "true";
      }

      function setCollapsed(collapsed) {
        groupRow.setAttribute("data-collapsed", collapsed ? "true" : "false");
        groupRow.setAttribute("aria-expanded", collapsed ? "false" : "true");
        var toggle = groupRow.querySelector(".htql-dt-group-toggle");
        if (toggle) {
          toggle.innerHTML = collapsed ? "&#9654;" : "&#9660;";
          toggle.title = collapsed ? "M\u1edf" : "Thu g\u1ecdn";
        }
        childRows().forEach(function (tr) {
          tr.classList.toggle("htql-dt-child-hidden", collapsed);
        });
        syncCollapsedParam(table);
      }

      groupRow.addEventListener("click", function (e) {
        if (e.target.closest("input, a, button, label")) return;
        setCollapsed(!isCollapsed());
      });

      groupRow.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setCollapsed(!isCollapsed());
        }
      });

      groupRow.setAttribute("tabindex", "0");
      groupRow.setAttribute("role", "button");
    });
  }

  function syncCollapsedParam(table) {
    var collapsed = [];
    table.querySelectorAll('.htql-dt-group-row[data-collapsed="true"]').forEach(function (row) {
      var id = row.getAttribute("data-group-id");
      if (id) collapsed.push(id);
    });
    var value = collapsed.join(",");
    document.querySelectorAll('input[name="collapsed"]').forEach(function (inp) {
      inp.value = value;
    });
    var url = new URL(window.location.href);
    if (value) url.searchParams.set("collapsed", value);
    else url.searchParams.delete("collapsed");
    history.replaceState(null, "", url.toString());
  }

  /* ── Column resize ──────────────────────────────────────── */
  function setupResize(th, table) {
    if (th.style.width === "" && th.offsetWidth > 0) {
      th.style.width = th.offsetWidth + "px";
    }

    var handle = document.createElement("div");
    handle.className = "htql-dt-resize";
    th.style.position = "relative";
    th.appendChild(handle);

    var startX, startW;

    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      startX = e.pageX;
      startW = th.offsetWidth;
      handle.classList.add("htql-dt-resizing");
      table.classList.add("htql-dt-col-resizing");

      function onMove(ev) {
        var diff = ev.pageX - startX;
        var newW = Math.max(40, startW + diff);
        th.style.width = newW + "px";
        th.style.minWidth = newW + "px";
      }

      function onUp() {
        handle.classList.remove("htql-dt-resizing");
        table.classList.remove("htql-dt-col-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    handle.addEventListener("touchstart", function (e) {
      e.stopPropagation();
      var touch = e.touches[0];
      startX = touch.pageX;
      startW = th.offsetWidth;
      handle.classList.add("htql-dt-resizing");
      table.classList.add("htql-dt-col-resizing");

      function onMove(ev) {
        var t = ev.touches[0];
        var diff = t.pageX - startX;
        var newW = Math.max(40, startW + diff);
        th.style.width = newW + "px";
        th.style.minWidth = newW + "px";
      }

      function onUp() {
        handle.classList.remove("htql-dt-resizing");
        table.classList.remove("htql-dt-col-resizing");
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      }

      document.addEventListener("touchmove", onMove);
      document.addEventListener("touchend", onUp);
    }, { passive: true });
  }

  /* ── Sort ────────────────────────────────────────────────── */
  function updateSortIcons(ths, sortCol, sortDir) {
    ths.forEach(function (th, i) {
      var icon = th.querySelector(".htql-dt-sort-icon");
      if (!icon) return;
      if (i === sortCol && sortDir !== 0) {
        icon.classList.add("active");
        icon.setAttribute("icon", sortDir === 1 ? "solar:sort-from-top-to-bottom-linear" : "solar:sort-from-bottom-to-top-linear");
      } else {
        icon.classList.remove("active");
        icon.setAttribute("icon", "solar:sort-vertical-linear");
      }
    });
  }

  function cellText(tr, colIdx) {
    var td = tr.children[colIdx];
    return td ? (td.getAttribute("data-sort") || td.textContent || "").trim() : "";
  }

  function applySort(tbody, dataRows, groupRows, sortCol, sortDir) {
    if (sortDir === 0) {
      reattachRows(tbody, groupRows, dataRows);
      return;
    }

    var sorted = dataRows.slice().sort(function (a, b) {
      var aVal = cellText(a, sortCol);
      var bVal = cellText(b, sortCol);
      var aNum = parseFloat(aVal.replace(/[^\d.,-]/g, "").replace(",", "."));
      var bNum = parseFloat(bVal.replace(/[^\d.,-]/g, "").replace(",", "."));
      var cmp;
      if (!isNaN(aNum) && !isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        cmp = aVal.localeCompare(bVal, "vi", { numeric: true });
      }
      return cmp * sortDir;
    });

    reattachRows(tbody, groupRows, sorted);
  }

  function reattachRows(tbody, groupRows, dataRows) {
    var totalsRow = tbody.querySelector("tr.htql-dt-totals");
    groupRows.forEach(function (gr) { tbody.appendChild(gr); });
    dataRows.forEach(function (dr) {
      var gid = dr.getAttribute("data-group");
      if (gid) {
        var groupTr = groupRows.find(function (g) { return g.getAttribute("data-group-id") === gid; });
        if (groupTr) {
          groupTr.after(dr);
          return;
        }
      }
      tbody.appendChild(dr);
    });
    if (totalsRow) tbody.appendChild(totalsRow);
  }
})();
