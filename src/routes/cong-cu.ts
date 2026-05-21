import { Hono } from 'hono';
import type { Env } from '../types';
import { layout } from '../utils/layout';

export const congCuRoutes = new Hono<{ Bindings: Env }>();

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

congCuRoutes.get('/', async (c) => {
  const user = c.get('user');

  const content = `
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Công cụ & tích hợp</h1>
      <span class="text-sm text-gray-400 ml-auto">Truy cập nhanh các nền tảng vận tải, mẫu Excel, máy tính cước</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">🇵🇱</div>
          <div>
            <div class="font-semibold text-blue-600">PUESC SENT</div>
            <div class="text-xs text-gray-400">Khai báo giám sát vận tải Ba Lan</div>
          </div>
        </div>
        <div class="text-xs text-gray-500 mb-3">Hệ thống bắt buộc khi vận chuyển hàng nhạy cảm (rượu, thuốc lá, dầu...)</div>
        <a href="https://puesc.gov.pl" target="_blank" class="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 no-underline" style="text-decoration:none">→ Mở PUESC</a>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">📦</div>
          <div>
            <div class="font-semibold text-blue-600">Huzar SENT</div>
            <div class="text-xs text-gray-400">Khai báo SENT thông qua Huzar</div>
          </div>
        </div>
        <div class="text-xs text-gray-500 mb-3">Phần mềm desktop hỗ trợ khai SENT nhanh hơn web PUESC</div>
        <a href="https://www.huzar.pl" target="_blank" class="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 no-underline" style="text-decoration:none">→ Mở Huzar</a>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">📄</div>
          <div>
            <div class="font-semibold text-blue-600">FillUP CMR</div>
            <div class="text-xs text-gray-400">Tạo phiếu CMR vận chuyển quốc tế</div>
          </div>
        </div>
        <div class="text-xs text-gray-500 mb-3">Mẫu CMR điện tử dành cho EU - bắt buộc khi xuất khẩu</div>
        <a href="https://www.fillup.pl" target="_blank" class="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 no-underline" style="text-decoration:none">→ Mở FillUP</a>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">🧮</div>
          <div>
            <div class="font-semibold text-blue-600">Máy tính cước nhanh</div>
            <div class="text-xs text-gray-400">Ước tính cước theo km + nhiên liệu</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
          <label class="text-xs text-gray-500">Km <input type="number" id="calc-km" placeholder="1700" oninput="calcCuoc()" class="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"></label>
          <label class="text-xs text-gray-500">Tiêu thụ L/100km <input type="number" id="calc-tieu" value="32" oninput="calcCuoc()" class="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"></label>
          <label class="text-xs text-gray-500">Giá xăng PLN/L <input type="number" id="calc-gia" value="6.5" oninput="calcCuoc()" step="0.1" class="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"></label>
          <label class="text-xs text-gray-500">Hệ số chi khác x <input type="number" id="calc-hs" value="1.4" oninput="calcCuoc()" step="0.1" class="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"></label>
        </div>
        <div id="calc-result" class="mt-3 p-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">Nhập km để tính</div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">📊</div>
          <div>
            <div class="font-semibold text-blue-600">Mẫu Excel báo cáo</div>
            <div class="text-xs text-gray-400">Tải mẫu chuẩn cho công ty</div>
          </div>
        </div>
        <div class="flex flex-col gap-2 mt-3">
          <a href="#" class="text-sm text-blue-600 hover:underline">📥 Mẫu sổ thu chi tháng</a>
          <a href="#" class="text-sm text-blue-600 hover:underline">📥 Mẫu báo cáo công nợ KH</a>
          <a href="#" class="text-sm text-blue-600 hover:underline">📥 Mẫu báo cáo chuyến xe</a>
          <a href="#" class="text-sm text-blue-600 hover:underline">📥 Mẫu bảng lương tháng</a>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">💱</div>
          <div>
            <div class="font-semibold text-blue-600">Tỷ giá NBP</div>
            <div class="text-xs text-gray-400">Tỷ giá chính thức Ngân hàng Trung ương BL</div>
          </div>
        </div>
        <div class="text-sm my-3">EUR/PLN: <b>4.30</b> | USD/PLN: <b>3.95</b></div>
        <a href="https://www.nbp.pl/home.aspx?f=/kursy/kursya.html" target="_blank" class="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 no-underline" style="text-decoration:none">→ Xem NBP</a>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">📁</div>
          <div>
            <div class="font-semibold text-blue-600">Backup & Xuất dữ liệu</div>
            <div class="text-xs text-gray-400">Sao lưu toàn bộ hệ thống</div>
          </div>
        </div>
        <div class="flex flex-col gap-2 mt-3">
          <a href="/manager/api/export-backup" class="text-sm text-blue-600 hover:underline">💾 Tải backup toàn bộ (JSON)</a>
          <span class="text-xs text-gray-400">📂 Restore: truy cập tab Quản lý</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-3xl">🚚</div>
          <div>
            <div class="font-semibold text-blue-600">Hướng dẫn lái xe</div>
            <div class="text-xs text-gray-400">Quy trình giao nhận chuẩn</div>
          </div>
        </div>
        <ol class="text-xs text-gray-500 mt-3 pl-4 leading-relaxed" style="line-height:1.8">
          <li>Nhận lệnh chuyến + CMR từ điều phối</li>
          <li>Khai SENT trên PUESC trước khi xuất phát</li>
          <li>Đến điểm lấy: ký nhận hàng, chụp ảnh hàng + niêm phong</li>
          <li>Trên đường: cập nhật vị trí qua app, giữ chứng từ</li>
          <li>Đến điểm trả: khách ký CMR, chụp ảnh nhận hàng</li>
          <li>Về kho: nộp toàn bộ chứng từ + hóa đơn xăng</li>
        </ol>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow col-span-full" style="background:#dcfce7">
        <div class="font-semibold text-green-700 text-lg mb-2">☁ Đồng bộ Google Sheets (Apps Script)</div>
        <div class="text-sm text-green-800">Dùng Google Apps Script để đồng bộ dữ liệu D1 với Google Sheets — dễ hơn code API xuất Excel.</div>
        <div class="mt-2 text-xs text-green-700"><b>Các bước:</b> Tạo Google Sheet → Extensions > Apps Script → Copy mã → Deploy → Set trigger hàng ngày.</div>
      </div>
    </div>

    <script>
    function calcCuoc() {
      const km = parseFloat(document.getElementById('calc-km').value) || 0;
      const tieu = parseFloat(document.getElementById('calc-tieu').value) || 32;
      const gia = parseFloat(document.getElementById('calc-gia').value) || 6.5;
      const hs = parseFloat(document.getElementById('calc-hs').value) || 1.4;
      if (km <= 0) { document.getElementById('calc-result').innerHTML = 'Nhập km để tính'; return; }
      const nhienLieu = (km / 100) * tieu;
      const tienXang = nhienLieu * gia;
      const chiKhac = tienXang * (hs - 1);
      const tong = tienXang + chiKhac;
      document.getElementById('calc-result').innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:13px">' +
        '<span>Nhiên liệu: <b>' + nhienLieu.toFixed(1) + ' L</b></span>' +
        '<span>Tiền xăng: <b>' + tienXang.toLocaleString() + ' PLN</b></span>' +
        '<span>Chi phí khác: <b>' + chiKhac.toLocaleString() + ' PLN</b></span>' +
        '<span style="color:#2563eb;font-weight:700">Tổng: <b>' + tong.toLocaleString() + ' PLN</b></span>' +
        '</div>';
    }
    </script>
  `;

  return c.html(layout('Công cụ', content, user, 'cong-cu'));
});
