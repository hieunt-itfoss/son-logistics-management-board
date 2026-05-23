import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { layout } from '../utils/layout';
import { kpiCard, panelCard, th } from '../utils/ui';
import { computeReceivables, computeFundBalance, computePayablesVT } from '../utils/finance';

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const TT_LABEL: Record<string, string> = {
  planned: 'Kế hoạch',
  dang_chay: 'Đang chạy',
  hoan_thanh: 'Hoàn thành',
  huy: 'Hủy',
};

dashboardRoutes.get('/', async (c) => {
  const user = c.get('user');
  const perms = c.get('perms');
  const showProfit = perms.canViewLoiNhuan;

  const compactTable = (headers: string, tbodyId: string, colspan: number) =>
    `<div class="overflow-x-auto -mx-1"><table class="htql-table htql-table--compact min-w-full w-full">
      <thead><tr class="border-b border-light-dark">${headers}</tr></thead>
      <tbody id="${tbodyId}"><tr><td colspan="${colspan}" class="py-6 text-center text-bodytext text-sm">Đang tải…</td></tr></tbody>
    </table></div>`;

  const content = `
    <div class="htql-dashboard" style="display:flex;flex-direction:column;gap:24px">

      <div class="htql-dash-grid-5">
        ${kpiCard('Doanh thu hôm nay', '-', {
          id: 'stat-revenue-today',
          tone: 'primary',
          icon: 'solar:wallet-money-bold-duotone',
          hintHtml: 'Thu tiền: <span id="stat-collected-today">-</span>',
        })}
        ${showProfit ? kpiCard('Lợi nhuận tháng', '-', {
          id: 'stat-profit-month',
          tone: 'success',
          icon: 'solar:chart-2-bold-duotone',
          hintHtml: 'Thu − Chi tháng này',
        }) : ''}
        ${kpiCard('Tồn quỹ', '-', {
          id: 'stat-fund',
          tone: 'info',
          icon: 'solar:safe-square-bold-duotone',
          hintHtml: 'Đầu kỳ + Thu − Chi',
        })}
        ${kpiCard('Công nợ thu', '-', {
          id: 'stat-receivable',
          tone: 'warning',
          icon: 'solar:bill-list-bold-duotone',
          href: '/doi-tac',
          hintHtml: 'Quá hạn: <span id="stat-overdue">-</span> KH',
        })}
        ${kpiCard('Chuyến đang chạy', '-', {
          id: 'stat-active-trips',
          tone: 'success',
          icon: 'solar:bus-bold-duotone',
          href: '/chuyen-xe',
        })}
      </div>

      <div class="htql-dash-grid-main-side">
        <div>
          ${panelCard({ title: 'Thu vs Chi — 6 tháng', body: '<div id="chart-thu-chi-month"></div>' })}
        </div>
        <div>
          ${panelCard({ title: 'Chuyến theo trạng thái', body: '<div id="chart-trip-status"></div>' })}
        </div>
      </div>

      <div class="${showProfit ? 'htql-dash-grid-2' : ''}">
        ${showProfit ? `<div>${panelCard({ title: 'Lợi nhuận theo tháng', body: '<div id="chart-profit-month"></div>' })}</div>` : ''}
        <div>
          ${panelCard({ title: 'Doanh thu VT theo tuyến', body: '<div id="chart-revenue-route"></div>' })}
        </div>
      </div>

      <div class="htql-dash-grid-main-side">
        <div>
          ${panelCard({ title: 'Dòng tiền — 30 ngày', body: '<div id="chart-revenue-expenses"></div>' })}
        </div>
        <div>
          ${panelCard({ title: 'Top khách nợ', body: '<div id="chart-top-debtors"></div>' })}
        </div>
      </div>

      <div class="htql-dash-grid-3">
        <div>
          ${panelCard({
            title: 'Chuyến đang chạy',
            body: compactTable(
              th('Mã') + th('Tuyến') + th('Kiện', { align: 'right' }),
              'table-active-trips',
              3,
            ),
          })}
        </div>
        <div>
          ${panelCard({
            title: 'Khách quá hạn',
            body: compactTable(
              th('Khách') + th('Nợ') + th('Ngày', { align: 'right' }),
              'table-overdue',
              3,
            ),
          })}
        </div>
        <div>
          ${panelCard({
            title: 'Vận hành',
            body: `<div class="htql-ops-mini">
              <div class="htql-ops-mini-item"><div class="value text-dark dark:text-white" id="ops-cargo">-</div><div class="label">Phiếu hàng</div></div>
              <div class="htql-ops-mini-item"><div class="value text-warning" id="ops-warehouse">-</div><div class="label">Kiện lưu kho</div></div>
              <div class="htql-ops-mini-item"><div class="value text-error" id="ops-payable-vt">-</div><div class="label">Nợ cty VT</div></div>
              <div class="htql-ops-mini-item"><div class="value text-primary" id="ops-customers">-</div><div class="label">Khách hàng</div></div>
            </div>`,
          })}
        </div>
      </div>

      <div class="htql-dash-grid-2">
        <div>
          ${panelCard({
            title: 'Phiếu thu gần nhất',
            body: compactTable(
              th('Mã') + th('Ngày') + th('Số tiền', { align: 'right' }),
              'table-recent-thu',
              3,
            ),
          })}
        </div>
        <div>
          ${panelCard({
            title: 'Phiếu chi gần nhất',
            body: compactTable(
              th('Mã') + th('Ngày') + th('Số tiền', { align: 'right' }),
              'table-recent-chi',
              3,
            ),
          })}
        </div>
      </div>

    </div>

    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <script>
    (async function() {
      function esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }
      function fmtNum(n) { return Number(n||0).toLocaleString('vi-VN'); }
      function fmtCcy(m) {
        if (!m || typeof m !== 'object') return '0';
        var parts = Object.keys(m).filter(function(k){ return m[k]; }).map(function(k){ return fmtNum(m[k])+' '+k; });
        return parts.length ? parts.join(' · ') : '0';
      }
      function showEmpty(el, msg) {
        if (el) el.innerHTML = '<div class="htql-chart-empty py-12 text-center text-bodytext">'+msg+'</div>';
      }
      function renderChart(el, options) {
        if (!el || typeof ApexCharts === 'undefined') return null;
        try {
          var chart = new ApexCharts(el, options);
          chart.render();
          return chart;
        } catch (err) {
          console.error('Chart error:', err);
          showEmpty(el, 'Không thể hiển thị biểu đồ');
          return null;
        }
      }
      function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      }
      function setHtml(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
      }

      try {
        var res = await fetch('/api/dashboard/analytics', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('API '+res.status);
        var data = await res.json();
        var s = data.summary;

        setText('stat-revenue-today', fmtCcy(s.revenueTodayVT));
        setText('stat-collected-today', fmtCcy(s.collectedToday));
        if (data.canViewLoiNhuan) {
          setText('stat-profit-month', fmtCcy(s.profitMonth));
          setText('stat-fund', fmtCcy(s.fundBalance));
        }
        setText('stat-receivable', fmtCcy(s.receivable));
        setText('stat-overdue', String(s.overdueCustomers||0));
        setText('stat-active-trips', String(s.activeTrips||0));

        setText('ops-cargo', fmtNum(s.cargoBatches));
        setText('ops-warehouse', fmtNum(s.warehouseItems));
        if (data.canViewLoiNhuan) setText('ops-payable-vt', fmtCcy(s.payableVT));
        setText('ops-customers', fmtNum(s.customers));

        var activeTrips = data.activeTrips || [];
        if (activeTrips.length === 0) {
          setHtml('table-active-trips', '<tr><td colspan="3" class="py-6 text-center text-bodytext text-sm">Không có chuyến đang chạy</td></tr>');
        } else {
          setHtml('table-active-trips', activeTrips.map(function(t) {
            return '<tr><td><a href="/chuyen-xe/'+esc(t.id)+'" class="text-primary font-mono text-xs hover:underline">'+esc(t.id)+'</a></td>'+
              '<td class="truncate max-w-[140px]">'+esc(t.tuyen_ten)+'</td>'+
              '<td class="text-right tabular-nums">'+fmtNum(t.total_kien)+'</td></tr>';
          }).join(''));
        }

        var overdue = data.overdueCustomers || [];
        if (overdue.length === 0) {
          setHtml('table-overdue', '<tr><td colspan="3" class="py-6 text-center text-bodytext text-sm">Không có khách quá hạn</td></tr>');
        } else {
          setHtml('table-overdue', overdue.map(function(k) {
            return '<tr><td class="truncate max-w-[120px]"><a href="/doi-tac/khach-hang/'+esc(k.id)+'" class="text-primary hover:underline">'+esc(k.ten)+'</a></td>'+
              '<td class="text-error text-xs font-medium">'+fmtCcy(k.con_no)+'</td>'+
              '<td class="text-right text-error text-xs font-semibold">'+k.qua_han+'d</td></tr>';
          }).join(''));
        }

        var recentThu = data.recentThu || [];
        setHtml('table-recent-thu', recentThu.length ? recentThu.map(function(r) {
          return '<tr><td class="font-mono text-xs text-bodytext">'+esc(r.id)+'</td><td class="text-xs">'+esc(r.ngay)+'</td>'+
            '<td class="text-right text-success text-xs font-medium tabular-nums">+'+fmtNum(r.so_tien)+' '+esc(r.tien_te)+'</td></tr>';
        }).join('') : '<tr><td colspan="3" class="py-6 text-center text-bodytext text-sm">Chưa có phiếu thu</td></tr>');

        var recentChi = data.recentChi || [];
        setHtml('table-recent-chi', recentChi.length ? recentChi.map(function(r) {
          return '<tr><td class="font-mono text-xs text-bodytext">'+esc(r.id)+'</td><td class="text-xs truncate max-w-[100px]" title="'+esc(r.dau_muc)+'">'+esc(r.ngay)+'</td>'+
            '<td class="text-right text-error text-xs font-medium tabular-nums">−'+fmtNum(r.so_tien)+' '+esc(r.tien_te)+'</td></tr>';
        }).join('') : '<tr><td colspan="3" class="py-6 text-center text-bodytext text-sm">Chưa có phiếu chi</td></tr>');

        var chartH = { main: 260, side: 240 };
        var chartOpts = { chart: { toolbar: { show: false }, fontFamily: 'inherit' }, dataLabels: { enabled: false } };

        var tcm = data.thuChiByMonth || [];
        var tcmEl = document.getElementById('chart-thu-chi-month');
        if (!tcm.length) showEmpty(tcmEl, 'Chưa có phiếu thu/chi');
        else renderChart(tcmEl, Object.assign({}, chartOpts, {
          chart: { type: 'bar', height: chartH.main, toolbar: { show: false }, fontFamily: 'inherit', stacked: false },
          series: [
            { name: 'Thu', data: tcm.map(function(d){ return d.thu; }) },
            { name: 'Chi', data: tcm.map(function(d){ return d.chi; }) }
          ],
          xaxis: { categories: tcm.map(function(d){ return d.month; }) },
          colors: ['#13DEB9', '#FA896B'],
          plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
          yaxis: { labels: { formatter: function(v){ return fmtNum(v); } } }
        }));

        var pm = data.canViewLoiNhuan ? (data.profitByMonth || []) : [];
        var pmEl = document.getElementById('chart-profit-month');
        if (!pmEl) { /* hidden for role */ }
        else if (!pm.length) showEmpty(pmEl, 'Chưa có dữ liệu lợi nhuận');
        else renderChart(pmEl, Object.assign({}, chartOpts, {
          chart: { type: 'bar', height: chartH.side, toolbar: { show: false }, fontFamily: 'inherit' },
          series: [{ name: 'Lợi nhuận (PLN)', data: pm.map(function(d){ return d.profitPLN; }) }],
          xaxis: { categories: pm.map(function(d){ return d.month; }) },
          colors: ['#5D87FF'],
          plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
          yaxis: { labels: { formatter: function(v){ return fmtNum(v); } } }
        }));

        var rev = data.revenueVsExpenses || [];
        var revEl = document.getElementById('chart-revenue-expenses');
        if (!rev.length) showEmpty(revEl, 'Chưa có phiếu trong 30 ngày');
        else renderChart(revEl, Object.assign({}, chartOpts, {
          chart: { type: 'area', height: chartH.main, toolbar: { show: false }, fontFamily: 'inherit' },
          series: [
            { name: 'Thu', data: rev.map(function(d){ return d.revenue; }) },
            { name: 'Chi', data: rev.map(function(d){ return d.expenses; }) }
          ],
          xaxis: { categories: rev.map(function(d){ return d.date; }) },
          colors: ['#13DEB9', '#FA896B'],
          stroke: { width: 2, curve: 'smooth' },
          fill: { type: 'gradient', opacity: 0.15 },
          yaxis: { labels: { formatter: function(v){ return fmtNum(v); } } }
        }));

        var routes = data.revenueByRoute || [];
        var routeEl = document.getElementById('chart-revenue-route');
        if (!routes.length) showEmpty(routeEl, 'Chưa có doanh thu theo tuyến tháng này');
        else renderChart(routeEl, Object.assign({}, chartOpts, {
          chart: { type: 'bar', height: chartH.side, toolbar: { show: false }, fontFamily: 'inherit' },
          series: [{ name: 'Doanh thu VT', data: routes.map(function(d){ return d.revenue; }) }],
          xaxis: { categories: routes.map(function(d){ return d.tuyen; }), labels: { rotate: -25 } },
          colors: ['#5D87FF'],
          plotOptions: { bar: { borderRadius: 4, horizontal: true } }
        }));

        var ts = data.tripStatus || [];
        var tsEl = document.getElementById('chart-trip-status');
        if (!ts.length) showEmpty(tsEl, 'Chưa có chuyến');
        else renderChart(tsEl, Object.assign({}, chartOpts, {
          chart: { type: 'donut', height: chartH.side, fontFamily: 'inherit' },
          series: ts.map(function(d){ return d.count; }),
          labels: ts.map(function(d){ return d.label; }),
          legend: { position: 'bottom' },
          colors: ['#5D87FF', '#13DEB9', '#FFAE1F', '#FA896B']
        }));

        var debtors = data.topDebtors || [];
        var debtEl = document.getElementById('chart-top-debtors');
        if (!debtors.length) showEmpty(debtEl, 'Không có công nợ');
        else renderChart(debtEl, Object.assign({}, chartOpts, {
          chart: { type: 'bar', height: chartH.side, toolbar: { show: false }, fontFamily: 'inherit' },
          series: [{ name: 'Còn nợ (PLN quy đổi)', data: debtors.map(function(d){ return d.totalPLN; }) }],
          xaxis: { categories: debtors.map(function(d){ return d.ten; }) },
          colors: ['#FFAE1F'],
          plotOptions: { bar: { borderRadius: 4, horizontal: true } }
        }));

      } catch (e) {
        console.error('Dashboard load failed:', e);
        ['chart-thu-chi-month','chart-profit-month','chart-revenue-expenses','chart-revenue-route',
         'chart-trip-status','chart-top-debtors'].forEach(function(id) {
          showEmpty(document.getElementById(id), 'Không tải được dữ liệu');
        });
      }
    })();
    </script>
  `;

  return c.html(layout('Trang chủ', content, user, 'dashboard'));
});

dashboardRoutes.get('/dashboard', async (c) => c.redirect('/'));

dashboardRoutes.get('/api/dashboard/analytics', async (c) => {
  const perms = c.get('perms');
  const db = c.env.DB;

  const [
    customers,
    activeTripsCount,
    cargoBatches,
    warehouseItems,
    receivables,
    fund,
    payablesVT,
    revenueTodayVT,
    collectedToday,
    thuMonth,
    chiMonth,
    thuByMonth,
    chiByMonth,
    tripsByStatus,
    revenueByRoute,
    activeTrips,
    recentThu,
    recentChi,
    revByDay,
    expByDay,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM khach_hang').first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) as c FROM chuyen_xe WHERE trang_thai = 'dang_chay'").first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM lo_hang').first<{ c: number }>(),
    db.prepare('SELECT COALESCE(SUM(so_kien - da_tra_hang), 0) as c FROM lo_hang WHERE so_kien > da_tra_hang').first<{ c: number }>(),
    computeReceivables(db),
    computeFundBalance(db),
    computePayablesVT(db),
    db.prepare(
      `SELECT lh.tien_te, COALESCE(SUM(lh.thanh_tien - lh.giam_gia), 0) as total
       FROM lo_hang lh
       JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
       WHERE date(cx.ngay_di) = date('now')
       GROUP BY lh.tien_te`,
    ).all<{ tien_te: string; total: number }>(),
    db.prepare(
      `SELECT tien_te, COALESCE(SUM(so_tien), 0) as total FROM phieu_thu
       WHERE date(ngay) = date('now') GROUP BY tien_te`,
    ).all<{ tien_te: string; total: number }>(),
    db.prepare(
      `SELECT tien_te, COALESCE(SUM(so_tien), 0) as total FROM phieu_thu
       WHERE strftime('%Y-%m', ngay) = strftime('%Y-%m', 'now') GROUP BY tien_te`,
    ).all<{ tien_te: string; total: number }>(),
    db.prepare(
      `SELECT tien_te, COALESCE(SUM(so_tien), 0) as total FROM phieu_chi
       WHERE strftime('%Y-%m', ngay) = strftime('%Y-%m', 'now') GROUP BY tien_te`,
    ).all<{ tien_te: string; total: number }>(),
    db.prepare(
      `SELECT strftime('%Y-%m', ngay) as month, COALESCE(SUM(so_tien), 0) as total
       FROM phieu_thu WHERE ngay >= date('now', '-6 months') GROUP BY month ORDER BY month`,
    ).all<{ month: string; total: number }>(),
    db.prepare(
      `SELECT strftime('%Y-%m', ngay) as month, COALESCE(SUM(so_tien), 0) as total
       FROM phieu_chi WHERE ngay >= date('now', '-6 months') GROUP BY month ORDER BY month`,
    ).all<{ month: string; total: number }>(),
    db.prepare(
      `SELECT trang_thai, COUNT(*) as count FROM chuyen_xe GROUP BY trang_thai`,
    ).all<{ trang_thai: string; count: number }>(),
    db.prepare(
      `SELECT t.ten as tuyen, COALESCE(SUM(lh.thanh_tien - lh.giam_gia), 0) as revenue
       FROM lo_hang lh
       JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
       JOIN tuyen t ON cx.tuyen_id = t.id
       WHERE strftime('%Y-%m', cx.ngay_di) = strftime('%Y-%m', 'now')
       GROUP BY t.id ORDER BY revenue DESC LIMIT 8`,
    ).all<{ tuyen: string; revenue: number }>(),
    db.prepare(
      `SELECT cx.id, cx.ngay_di, t.ten as tuyen_ten, x.so_xe, nv.ten as tai_xe_ten,
              COALESCE(SUM(lh.so_kien), 0) as total_kien
       FROM chuyen_xe cx
       JOIN tuyen t ON cx.tuyen_id = t.id
       JOIN xe x ON cx.xe_id = x.id
       LEFT JOIN nhan_vien nv ON cx.tai_xe_id = nv.id
       LEFT JOIN lo_hang lh ON lh.chuyen_xe_id = cx.id
       WHERE cx.trang_thai = 'dang_chay'
       GROUP BY cx.id ORDER BY cx.ngay_di DESC LIMIT 10`,
    ).all<Record<string, unknown>>(),
    db.prepare(
      `SELECT pt.id, pt.ngay, pt.so_tien, pt.tien_te, kh.ten as khach_ten
       FROM phieu_thu pt LEFT JOIN khach_hang kh ON pt.khach_hang_id = kh.id
       ORDER BY pt.ngay DESC, pt.gio DESC LIMIT 8`,
    ).all<Record<string, unknown>>(),
    db.prepare(
      `SELECT id, ngay, dau_muc, so_tien, tien_te FROM phieu_chi
       ORDER BY ngay DESC, gio DESC LIMIT 8`,
    ).all<Record<string, unknown>>(),
    db.prepare(
      `SELECT strftime('%Y-%m-%d', ngay) as date, SUM(so_tien) as total FROM phieu_thu
       WHERE ngay >= date('now', '-30 days') GROUP BY date`,
    ).all<{ date: string; total: number }>(),
    db.prepare(
      `SELECT strftime('%Y-%m-%d', ngay) as date, SUM(so_tien) as total FROM phieu_chi
       WHERE ngay >= date('now', '-30 days') GROUP BY date`,
    ).all<{ date: string; total: number }>(),
  ]);

  const toMap = (rows: { tien_te: string; total: number }[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.tien_te || 'PLN'] = r.total;
    return m;
  };

  const revenueTodayVTMap = toMap(revenueTodayVT.results);
  const collectedTodayMap = toMap(collectedToday.results);
  const thuMonthMap = toMap(thuMonth.results);
  const chiMonthMap = toMap(chiMonth.results);

  const profitMonth: Record<string, number> = {};
  const allCcy = new Set([...Object.keys(thuMonthMap), ...Object.keys(chiMonthMap)]);
  for (const tte of allCcy) {
    profitMonth[tte] = (thuMonthMap[tte] || 0) - (chiMonthMap[tte] || 0);
  }

  const fundBalance: Record<string, number> = {};
  for (const [tte, b] of Object.entries(fund.byCcy)) {
    fundBalance[tte] = b.balance;
  }

  const thuMonthMap6 = new Map(thuByMonth.results.map((r) => [r.month, r.total]));
  const chiMonthMap6 = new Map(chiByMonth.results.map((r) => [r.month, r.total]));
  const allMonths = new Set([...thuMonthMap6.keys(), ...chiMonthMap6.keys()]);
  const sortedMonths = Array.from(allMonths).sort();
  const thuChiByMonth = sortedMonths.map((month) => ({
    month,
    thu: thuMonthMap6.get(month) || 0,
    chi: chiMonthMap6.get(month) || 0,
  }));

  const profitByMonth = sortedMonths.map((month) => {
    const thu = thuMonthMap6.get(month) || 0;
    const chi = chiMonthMap6.get(month) || 0;
    return { month, profitPLN: thu - chi };
  });

  const revMap: Record<string, number> = {};
  const expMap: Record<string, number> = {};
  for (const r of revByDay.results) revMap[r.date] = r.total;
  for (const e of expByDay.results) expMap[e.date] = e.total;
  const allDates = new Set([...Object.keys(revMap), ...Object.keys(expMap)]);
  const revenueVsExpenses = Array.from(allDates).sort().map((date) => ({
    date,
    revenue: revMap[date] || 0,
    expenses: expMap[date] || 0,
  }));

  const tripStatus = tripsByStatus.results.map((r) => ({
    status: r.trang_thai,
    label: TT_LABEL[r.trang_thai] || r.trang_thai,
    count: r.count,
  }));

  const overdueCustomers = receivables.topDebtors
    .filter((k) => k.qua_han > 0)
    .slice(0, 8);

  const topDebtors = receivables.topDebtors.slice(0, 8).map((k) => ({
    id: k.id,
    ten: k.ten,
    con_no: k.con_no,
    totalPLN: k.con_no.PLN || Object.values(k.con_no).reduce((s, v) => s + v, 0),
  }));

  return c.json({
    canViewLoiNhuan: perms.canViewLoiNhuan,
    summary: {
      customers: customers?.c ?? 0,
      activeTrips: activeTripsCount?.c ?? 0,
      cargoBatches: cargoBatches?.c ?? 0,
      warehouseItems: warehouseItems?.c ?? 0,
      revenueTodayVT: revenueTodayVTMap,
      collectedToday: collectedTodayMap,
      profitMonth: perms.canViewLoiNhuan ? profitMonth : {},
      fundBalance: perms.canViewLoiNhuan ? fundBalance : {},
      receivable: receivables.totalByCcy,
      overdueCustomers: receivables.overdueCount,
      payableVT: perms.canViewLoiNhuan ? payablesVT : {},
    },
    thuChiByMonth,
    profitByMonth: perms.canViewLoiNhuan ? profitByMonth : [],
    revenueVsExpenses,
    revenueByRoute: revenueByRoute.results,
    tripStatus,
    activeTrips: activeTrips.results,
    overdueCustomers,
    recentThu: recentThu.results,
    recentChi: recentChi.results,
    topDebtors,
  });
});
