const TYPE_ICONS = {
  expense: { bg: 'bg-brand', color: 'text-white', path: 'M12 5v14m0 0l6-6m-6 6l-6-6' },
  income: { bg: 'bg-accent-light', color: 'text-accent', path: 'M12 19V5m0 0l-6 6m6-6l6 6' },
  transfer: { bg: 'bg-gray-100', color: 'text-gray-500', path: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  bill_payment: { bg: 'bg-brand/10', color: 'text-brand', path: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  investment: { bg: 'bg-gray-100', color: 'text-gray-500', path: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  split_expense: { bg: 'bg-brand/10', color: 'text-brand', path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  reimbursement: { bg: 'bg-accent-light', color: 'text-accent', path: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
};

export default function TypeIcon({ type }) {
  const icon = TYPE_ICONS[type] ?? { bg: 'bg-gray-100', color: 'text-gray-500', path: 'M12 6v6m0 0v6m0-6h6m-6 0H6' };
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${icon.bg} flex-shrink-0`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${icon.color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon.path} />
      </svg>
    </div>
  );
}

export function getVariant(type) {
  if (type === 'income' || type === 'reimbursement') return 'income';
  if (type === 'expense' || type === 'bill_payment' || type === 'split_expense') return 'expense';
  return 'neutral';
}
