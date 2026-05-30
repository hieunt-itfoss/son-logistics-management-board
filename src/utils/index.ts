// Strip Vietnamese diacritics and extended Latin (Ó, ł…) for accent-insensitive matching.
// Used in search: "wolka" matches "WÓLKA", "tiep" matches "Tiệp".
export function khongDau(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function formatCurrency(amount: number, currency = 'PLN'): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateEntityId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

export function generateMaChuyen(tienTo: string, ngayDi: string, soXe: string): string {
  const [, m, d] = ngayDi.split('-');
  const yy = ngayDi.slice(2, 4);
  return `${tienTo}${yy}${m}${d}-${soXe}`;
}
