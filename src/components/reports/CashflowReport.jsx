import { useMemo } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { useCashflow } from '../../hooks/useReportData';
import { formatINR } from '../../utils/formatters';
import { formatCompactINR, monthLabel } from './insightsUi';

const MONTHS = 12;

function CashflowTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-4 py-2 text-sm space-y-0.5">
      <p className="font-medium text-gray-700 mb-1">{monthLabel(d.month)}</p>
      <p>Income: <span className="font-semibold">{formatINR(d.income)}</span></p>
      <p>Spent: <span className="font-semibold">{formatINR(d.expenses)}</span></p>
      <p>Saved: <span className="font-semibold">{formatINR(d.saved)}</span>{d.savings_rate != null && ` (${d.savings_rate}%)`}</p>
      {d.investments > 0 && <p className="text-gray-500">Invested: {formatINR(d.investments)}</p>}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold tabular-nums text-gray-900 mt-1 truncate">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </Card>
  );
}

export default function CashflowReport({ filters }) {
  const apiFilters = useMemo(
    () => ({ owners: filters.owners, beneficiaries: filters.beneficiaries }),
    [filters.owners, filters.beneficiaries],
  );
  const { data: rows, isLoading } = useCashflow(apiFilters, MONTHS);

  const data = useMemo(
    () => rows.map((d) => ({ ...d, label: monthLabel(d.month, { month: 'short' }) })),
    [rows],
  );

  const totals = useMemo(() => {
    const t = data.reduce(
      (acc, d) => ({
        income: acc.income + d.income,
        expenses: acc.expenses + d.expenses,
        saved: acc.saved + d.saved,
        investments: acc.investments + d.investments,
      }),
      { income: 0, expenses: 0, saved: 0, investments: 0 },
    );
    t.rate = t.income > 0 ? Math.round((t.saved / t.income) * 1000) / 10 : null;
    return t;
  }, [data]);

  if (isLoading && data.length === 0) {
    return <div className="py-16 flex justify-center"><LoadingSpinner size="h-8 w-8" /></div>;
  }
  if (data.length === 0 || (totals.income === 0 && totals.expenses === 0)) {
    return <Card className="p-6"><EmptyState message="No cashflow yet" description="Income and expenses will show up here." /></Card>;
  }

  const range = `${monthLabel(data[0].month, { month: 'short', year: 'numeric' })} – ${monthLabel(data[data.length - 1].month, { month: 'short', year: 'numeric' })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 min-h-[44px]">
        <h2 className="text-base font-bold text-gray-900">Income, spending and savings</h2>
        <p className="text-xs text-gray-400">{range}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Income" value={formatINR(totals.income)} />
        <Stat label="Spent" value={formatINR(totals.expenses)} />
        <Stat label="Saved" value={formatINR(totals.saved)} hint={totals.rate != null ? `${totals.rate}% of income` : undefined} />
        <Stat label="Invested" value={formatINR(totals.investments)} hint="Moved into investments" />
      </div>

      <Card className="p-5">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="amount"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={formatCompactINR}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              domain={[(min) => Math.min(0, Math.floor(min)), 100]}
              tick={{ fontSize: 11, fill: '#7c9a9e' }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CashflowTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar yAxisId="amount" dataKey="income" name="Income" fill="#2cbcac" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="amount" dataKey="expenses" name="Spent" fill="#1e2a30" radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="savings_rate"
              name="Savings rate"
              stroke="#7c9a9e"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
      <p className="text-xs text-gray-400">
        Saved is income minus spending, the same as Month in Review. Money moved into investments isn't spending, so it isn't subtracted.
      </p>
    </div>
  );
}
