// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as Indian Rupees using the Indian numbering system.
 * Example: formatINR(125000) → "₹1,25,000.00"
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatINR(amount) {
  return inrFormatter.format(amount);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DATE_FORMAT_OPTIONS = { day: '2-digit', month: 'short', year: 'numeric' };

/**
 * Formats a date string into a human-readable form like "19 Mar 2026".
 *
 * @param {string|Date} dateStr - ISO date string or Date object
 * @returns {string}
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', DATE_FORMAT_OPTIONS).replace(/\//g, ' ');
}

/**
 * Returns "Today", "Yesterday", or a formatted date string.
 *
 * @param {string|Date} dateStr - ISO date string or Date object
 * @returns {string}
 */
export function formatRelativeDate(dateStr) {
  // Extract the date portion as a plain string to avoid timezone issues.
  // Date-only strings like "2026-03-21" are parsed as UTC by the Date constructor,
  // which shifts the day when converted to local time in UTC+ timezones.
  const inputKey = String(dateStr).slice(0, 10);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (inputKey === todayKey) return 'Today';
  if (inputKey === yesterdayKey) return 'Yesterday';
  return formatDate(dateStr);
}

// ---------------------------------------------------------------------------
// Amount parsing
// ---------------------------------------------------------------------------

/**
 * Strips all non-numeric characters except the decimal point and converts
 * the result to a floating-point number.
 *
 * @param {string} str - Raw amount string (e.g. "₹1,25,000.50")
 * @returns {number}
 */
export function parseAmount(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

// ---------------------------------------------------------------------------
// Transaction type helpers
// ---------------------------------------------------------------------------

/**
 * Maps internal transaction type identifiers to human-readable labels.
 *
 * @param {string} type
 * @returns {string}
 */
export function transactionTypeLabel(type) {
  const labels = {
    expense: 'Expense',
    income: 'Income',
    transfer: 'Transfer',
    bill_payment: 'Bill Payment',
    investment: 'Investment',
    split_expense: 'Split Expense',
    reimbursement: 'Reimbursement',
  };
  return labels[type] ?? type;
}

/**
 * Maps internal transaction type identifiers to Tailwind CSS color classes.
 * Returns classes suitable for use as text color on a label or badge.
 *
 * @param {string} type
 * @returns {string}
 */
export function transactionTypeColor(type) {
  const colors = {
    expense: 'text-red-500',
    income: 'text-green-500',
    transfer: 'text-blue-500',
    bill_payment: 'text-orange-500',
    investment: 'text-purple-500',
    split_expense: 'text-yellow-500',
    reimbursement: 'text-cyan-500',
  };
  return colors[type] ?? 'text-gray-500';
}
