// ---------------------------------------------------------------------------
// Date range preset helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD (zero-padded). */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns { dateFrom, dateTo } for the current calendar month. */
export function getThisMonthRange(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { dateFrom: toDateStr(first), dateTo: toDateStr(last) };
}

/** Returns { dateFrom, dateTo } for the previous calendar month. */
export function getPreviousMonthRange(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { dateFrom: toDateStr(first), dateTo: toDateStr(last) };
}

/**
 * Returns { dateFrom, dateTo } spanning n months ending with the current month.
 * e.g. n=3 on Apr 18, 2026 → Feb 1, 2026 to Apr 30, 2026.
 */
export function getLastNMonthsRange(n, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth() - (n - 1), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
}

/**
 * Returns { dateFrom, dateTo } for the current Indian financial year (Apr 1 → Mar 31).
 * Jan/Feb/Mar belong to the FY that started the previous April.
 */
export function getFinancialYearRange(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const fyStartYear = m >= 3 ? y : y - 1; // Apr (index 3) starts new FY
  const start = new Date(fyStartYear, 3, 1); // Apr 1
  const end = new Date(fyStartYear + 1, 2, 31); // Mar 31 next year
  return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
}

/**
 * Preset definitions used by the FilterBar dropdown.
 * `custom` is intentionally not in this list — it's only a detected value.
 */
export const DATE_PRESETS = [
  { value: 'this_month',     label: 'This Month',     getRange: getThisMonthRange },
  { value: 'previous_month', label: 'Previous Month', getRange: getPreviousMonthRange },
  { value: 'last_3_months',  label: 'Last 3 Months',  getRange: () => getLastNMonthsRange(3) },
  { value: 'last_6_months',  label: 'Last 6 Months',  getRange: () => getLastNMonthsRange(6) },
  { value: 'financial_year', label: 'Financial Year', getRange: getFinancialYearRange },
  { value: 'all',            label: 'All Time',       getRange: () => ({ dateFrom: '', dateTo: '' }) },
];

/**
 * Returns the preset key matching the given date range, or 'custom' if none matches.
 * Empty dateFrom + empty dateTo returns 'all'.
 */
export function detectPreset(dateFrom, dateTo, today = new Date()) {
  if (!dateFrom && !dateTo) return 'all';

  const matches = (a, b) => a.dateFrom === b.dateFrom && a.dateTo === b.dateTo;
  const current = { dateFrom: dateFrom ?? '', dateTo: dateTo ?? '' };

  if (matches(current, getThisMonthRange(today))) return 'this_month';
  if (matches(current, getPreviousMonthRange(today))) return 'previous_month';
  if (matches(current, getLastNMonthsRange(3, today))) return 'last_3_months';
  if (matches(current, getLastNMonthsRange(6, today))) return 'last_6_months';
  if (matches(current, getFinancialYearRange(today))) return 'financial_year';
  return 'custom';
}
