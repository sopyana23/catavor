// Contoh kontrak API daftar pembayaran untuk pengujian browser lokal.
function countBy(rows, read) {
  const counts = { all: rows.length };
  for (const row of rows) {
    const value = read(row);
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function financePage(section, rows, params) {
  const isOrder = section === 'orders';
  const group = row => isOrder ? row.payment_status : row.is_active ? 'active' : 'inactive';
  const category = row => {
    if (!isOrder) return row.type;
    if (row.payment_mode === 'gateway_aulaa' || row.payment_mode === 'coupon_free') return row.payment_mode;
    return row.payment_method === 'qris' ? 'manual_qris' : 'manual_bank';
  };
  const kind = isOrder ? 'channel' : 'type';
  const status = params.get('status') || 'all';
  const channel = params.get(kind) || 'all';
  const q = (params.get('q') || '').trim().toLowerCase();
  const hits = rows.filter(row => String(isOrder ? row.order_number : row.code).toLowerCase().includes(q));
  const byStatus = row => status === 'all' || group(row) === status;
  const byMethod = row => channel === 'all' || category(row) === channel;
  const matches = hits.filter(row => byStatus(row) && byMethod(row));
  const limit = Number(params.get('limit') || 10);
  const page = Math.min(Number(params.get('page') || 1), Math.max(1, Math.ceil(matches.length / limit)));
  const facets = { status: countBy(hits.filter(byMethod), group), [kind]: countBy(hits.filter(byStatus), category) };
  const groups = countBy(hits, group);
  const kinds = countBy(hits, category);
  const summary = { total: hits.length, pending: groups.pending || 0, paid: groups.paid || 0,
    rejected: groups.rejected || 0, active: groups.active || 0, inactive: groups.inactive || 0,
    free: kinds.free || 0, discount: kinds.discount || 0,
    revenue: hits.reduce((sum, row) => sum + (row.payment_status === 'paid' ? row.final_amount : 0), 0) };
  const data = params.get('summary') === '1' ? [] : matches.slice((page - 1) * limit, page * limit);
  return { success: true, data, page, limit, total: matches.length, facets, summary };
}

module.exports = { financePage };
