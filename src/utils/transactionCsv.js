// ---------------------------------------------------------------------------
// CSV export helpers for transactions.
// Used by the Settings → Data Export card and the Transactions page download.
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS = [
  'id',
  'date',
  'type',
  'amount',
  'beneficiary',
  'platform',
  'owner',
  'notes',
  'tags',
  'accountNames',
  'categoryNames',
];

/** Escape a CSV cell, wrapping in quotes when needed. */
function csvEscape(v) {
  let str;
  if (v == null) str = '';
  else if (Array.isArray(v)) str = v.join(' | ');
  else str = String(v);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert a list of transactions to CSV. */
export function transactionsToCSV(transactions, columns = DEFAULT_COLUMNS) {
  const header = columns.join(',');
  const rows = transactions.map((txn) =>
    columns.map((col) => csvEscape(txn[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

/** Trigger a browser download for the given Blob with the given filename. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Returns a filename-safe timestamp like 2026-05-09T21-45-12. */
export function csvTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Convenience: build the CSV blob and download it. */
export function downloadTransactionsCSV(transactions, filename) {
  const csv = transactionsToCSV(transactions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename ?? `transactions-${csvTimestamp()}.csv`);
}
