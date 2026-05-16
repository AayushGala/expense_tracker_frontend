import { D } from './money';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Indian numbering: formatINR(125000) → "₹1,25,000.00".
// Accepts Decimal, string, or number; coerces for Intl.
export function formatINR(amount) {
  if (amount == null || amount === '') return inrFormatter.format(0);
  const num = typeof amount === 'number' ? amount : D(amount).toNumber();
  return inrFormatter.format(num);
}

const DATE_FORMAT_OPTIONS = { day: '2-digit', month: 'short', year: 'numeric' };

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', DATE_FORMAT_OPTIONS).replace(/\//g, ' ');
}

export function formatRelativeDate(dateStr) {
  // Compare via plain YYYY-MM-DD keys so a date-only string isn't reinterpreted
  // as UTC midnight and shifted a day off in our local timezone.
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

export function parseAmount(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, '');
  return D(cleaned);
}

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
