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
