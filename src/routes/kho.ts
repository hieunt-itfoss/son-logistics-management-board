import { Hono } from 'hono';
import type { Env } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, tableRow, tableEmpty, tableActions, formGroup, input, btnPrimary, btnSecondary } from '../utils/ui';

export const khoRoutes = new Hono<{ Bindings: Env }>();

khoRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, h.ten as hang_ten, cx.ngay_di, t.ten as tuyen_ten,
            (lh.so_kien - lh.da_tra_hang) as chua_tra
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.so_kien > lh.da_tra_hang
     ORDER BY lh.created_at DESC`
  ).all();

  const rows = (results as Array<Record<string, unknown>>).map((lh) =>
    tableRow([
      `<span class="font-mono text-bodytext">${String(lh.id).slice(0, 12)}…</span>`,
      String(lh.khach_hang_ten || '—'),
      String(lh.hang_ten || '—'),
      `${lh.tuyen_ten || '—'} (${lh.ngay_di || '—'})`,
      `<span class="font-medium">${lh.so_kien}</span>`,
      `<span class="text-success font-medium">${lh.da_tra_hang}</span>`,
      `<span class="text-error font-medium">${lh.chua_tra}</span>`,
      tableActions(`showUpdateForm('${lh.id}', ${lh.so_kien}, ${lh.da_tra_hang})`, undefined, undefined, { center: true }),
    ], { align: 'center' }),
  ).join('');

  const content = `
    ${pageHeader('Kho', { subtitle: 'Hàng chưa giao — cập nhật số kiện đã trả' })}

    <div id="updateForm" class="hidden mb-6">
      ${card({
        title: 'Cập nhật đã trả hàng',
        body: `<form id="khoForm" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <input type="hidden" name="id" id="khoId">
        ${formGroup('Tổng kiện', input({ type: 'text', id: 'khoTongKien', disabled: true }))}
        ${formGroup('Đã trả (trước)', input({ type: 'text', id: 'khoDaTraCu', disabled: true }))}
        ${formGroup('Đã trả (mới)', input({ type: 'number', name: 'da_tra_hang', id: 'khoDaTraMoi', required: true }))}
        <div class="sm:col-span-3">${formGroup('Lý do thiếu (nếu có)', input({ type: 'text', name: 'ly_do_thieu', id: 'khoLyDo' }))}</div>
        <div class="sm:col-span-3 flex gap-2">
          ${btnPrimary('Lưu', { type: 'submit' })}
          ${btnSecondary('Hủy', { onclick: 'hideUpdateForm()' })}
        </div>
      </form>`,
      })}
    </div>

    ${dataTable(
      ['Mã lô', 'Khách hàng', 'Hãng', 'Chuyến', 'Tổng kiện', 'Đã trả', 'Còn lại', 'Thao tác'],
      rows || tableEmpty(8, 'Không có hàng trong kho'),
      { align: 'center' },
    )}

    <script>
    function showUpdateForm(id, tongKien, daTra) {
      document.getElementById('khoId').value = id;
      document.getElementById('khoTongKien').value = tongKien;
      document.getElementById('khoDaTraCu').value = daTra;
      document.getElementById('khoDaTraMoi').value = daTra;
      document.getElementById('khoDaTraMoi').max = tongKien;
      document.getElementById('updateForm').classList.remove('hidden');
    }
    function hideUpdateForm() {
      document.getElementById('updateForm').classList.add('hidden');
      document.getElementById('khoForm').reset();
    }
    document.getElementById('khoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('khoId').value;
      const da_tra_hang = Number(document.getElementById('khoDaTraMoi').value);
      const ly_do_thieu = document.getElementById('khoLyDo').value;
      const res = await fetch('/kho/api/kho/update-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, da_tra_hang, ly_do_thieu })
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });
    </script>
  `;

  return c.html(layout('Kho', content, user, 'kho'));
});

khoRoutes.get('/api/kho', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, h.ten as hang_ten, cx.ngay_di, t.ten as tuyen_ten,
            (lh.so_kien - lh.da_tra_hang) as chua_tra
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.so_kien > lh.da_tra_hang
     ORDER BY lh.created_at DESC`
  ).all();
  return c.json(results);
});

khoRoutes.post('/api/kho/update-delivered', async (c) => {
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE lo_hang SET da_tra_hang=?, ly_do_thieu=?, updated_at=datetime(\'now\') WHERE id=?'
  ).bind(body.da_tra_hang, body.ly_do_thieu || '', body.id).run();
  return c.json({ success: true });
});
