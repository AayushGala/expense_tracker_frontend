import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useCategoryInsights } from '../hooks/useReportData';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { formatINR } from '../utils/formatters';
import { drilldownPath } from '../components/reports/MonthReview';
import {
  SectionCard, ShareRow, TopTransactions, currentMonthKey, monthLabel,
} from '../components/reports/insightsUi';

const FILTER_SCHEMA = {
  month: {},
  months: {},
  owners: { array: true },
  beneficiaries: { array: true },
};
const DEFAULTS = { months: '12' };
const RANGES = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
];

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-medium text-gray-700">{monthLabel(p.month)}</p>
      <p className="font-semibold text-gray-900">{formatINR(p.total)}</p>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold tabular-nums text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </Card>
  );
}

export default function CategoryInsightsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useUrlFilters(FILTER_SCHEMA, DEFAULTS);
  const apiFilters = useMemo(
    () => ({ owners: filters.owners, beneficiaries: filters.beneficiaries }),
    [filters.owners, filters.beneficiaries],
  );
  const { data, isLoading, error } = useCategoryInsights(id, apiFilters, filters.months, filters.month);

  const chartData = useMemo(
    () => (data?.trend ?? []).map((t) => ({
      ...t,
      label: monthLabel(t.month, { month: 'short' }),
    })),
    [data],
  );

  const transactionsLink = useMemo(() => {
    if (!data) return '/transactions';
    const params = new URLSearchParams();
    params.set('dateFrom', data.date_from);
    params.set('dateTo', data.date_to);
    for (const cid of data.category_ids) params.append('categoryIds', String(cid));
    for (const o of filters.owners) params.append('owners', o);
    for (const b of filters.beneficiaries) params.append('beneficiaries', b);
    return `/transactions?${params.toString()}`;
  }, [data, filters.owners, filters.beneficiaries]);

  const back = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
      </svg>
      Back
    </button>
  );

  if (isLoading && !data) {
    return <div className="space-y-4">{back}<div className="py-16 flex justify-center"><LoadingSpinner size="h-8 w-8" /></div></div>;
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        {back}
        <Card className="p-6"><EmptyState message="Category not found" description="It may have been deleted." /></Card>
      </div>
    );
  }

  const avg = data.monthly_average != null ? Number(data.monthly_average) : null;
  const maxChild = Math.max(0, ...data.children.map((c) => Number(c.total)));
  const maxPlatform = Math.max(0, ...data.platforms.map((p) => Number(p.total)));
  const rangeLabel = `${monthLabel(data.trend[0].month, { month: 'short', year: 'numeric' })} – ${monthLabel(data.trend[data.trend.length - 1].month, { month: 'short', year: 'numeric' })}`;

  return (
    <div className="space-y-4">
      {back}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {data.group && (
            <Link
              to={drilldownPath(data.group.category_id, filters)}
              className="text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
            >
              {data.group.name}
            </Link>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, months: r.value }))}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filters.months === r.value ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={data.month === currentMonthKey() ? 'This month' : monthLabel(data.month, { month: 'long' })} value={formatINR(data.this_month)} />
        <Stat label="Monthly average" value={avg != null ? formatINR(avg) : '—'} hint={avg != null ? 'Complete months only' : 'Needs a full month'} />
        <Stat label="Per transaction" value={data.average_per_transaction != null ? formatINR(data.average_per_transaction) : '—'} />
        <Stat label="Transactions" value={data.count} hint={`${formatINR(data.total)} in total`} />
      </div>

      <SectionCard title="Month by month">
        {data.count === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No spending in this category yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: '#f3f4f6' }} />
              {avg != null && (
                <ReferenceLine y={avg} stroke="#7c9a9e" strokeDasharray="4 4" label={{ value: 'avg', position: 'insideTopRight', fontSize: 10, fill: '#7c9a9e' }} />
              )}
              <Bar dataKey="total" fill="#1e2a30" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.children.length > 0 && (
          <SectionCard title="By subcategory">
            <div className="divide-y divide-gray-100">
              {data.children.map((c) => (
                <ShareRow
                  key={c.category_id}
                  label={c.name}
                  amount={c.total}
                  max={maxChild}
                  onClick={() => navigate(drilldownPath(c.category_id, filters))}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {data.platforms.length > 0 && (
          <SectionCard title="Where">
            <div className="divide-y divide-gray-100">
              {data.platforms.map((p) => (
                <ShareRow
                  key={p.platform || '__none'}
                  label={p.platform || 'No platform'}
                  sublabel={`${p.count} transaction${p.count === 1 ? '' : 's'} · ${formatINR(Number(p.total) / Math.max(1, p.count))} avg`}
                  amount={p.total}
                  max={maxPlatform}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {data.top_transactions.length > 0 && (
          <SectionCard
            title="Largest transactions"
            action={<Link to={transactionsLink} className="text-xs font-semibold text-accent hover:underline">View all</Link>}
          >
            <TopTransactions transactions={data.top_transactions} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
