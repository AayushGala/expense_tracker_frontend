import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import HideAmountsToggle from '../common/HideAmountsToggle';
import AccountHistory from './AccountHistory';
import { useNetWorthHistory } from '../../hooks/useReportData';
import { useHideAmounts } from '../../hooks/useHideAmounts';
import { formatINR, MASKED_AMOUNT } from '../../utils/formatters';
import { ChangeChip, formatCompactINR, monthLabel } from './insightsUi';

const MONTHS = 12;

function NetWorthTooltip({ active, payload, hidden }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const money = (v) => (hidden ? MASKED_AMOUNT : formatINR(v));
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-4 py-2 text-sm space-y-0.5">
      <p className="font-medium text-gray-700 mb-1">End of {monthLabel(d.month)}</p>
      <p>Net worth: <span className="font-semibold">{money(d.net_worth)}</span></p>
      <p className="text-gray-500">Assets {money(d.assets)} · Liabilities {money(d.liabilities)}</p>
    </div>
  );
}

function Stat({ label, value, chip, hidden }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-1 truncate ${hidden ? 'text-gray-400' : 'text-gray-900'}`}>
        {hidden ? MASKED_AMOUNT : value}
      </p>
      {chip && <div className="mt-1">{chip}</div>}
    </Card>
  );
}

export default function NetWorthReport({ owners = [] }) {
  const { data, isLoading } = useNetWorthHistory(owners, MONTHS);
  const [hidden, toggleHidden] = useHideAmounts();

  if (isLoading && data.length === 0) {
    return <div className="py-16 flex justify-center"><LoadingSpinner size="h-8 w-8" /></div>;
  }
  if (data.length === 0) {
    return <Card className="p-6"><EmptyState message="No account history yet" description="Balances show up once accounts have transactions." /></Card>;
  }

  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month, { month: 'short' }) }));
  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const first = data[0];
  const pct = (now, then) => (then ? ((now - then) / Math.abs(then)) * 100 : null);
  const chip = (now, then) => (
    // Net worth going up is good, so goodWhenDown is off.
    <ChangeChip change={now - then} pct={pct(now, then)} goodWhenDown={false} compact />
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3 min-h-[44px]">
          <h2 className="text-base font-bold text-gray-900 flex-1">Net worth over time</h2>
          <HideAmountsToggle hidden={hidden} onToggle={toggleHidden} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Net worth now" value={formatINR(last.net_worth)} hidden={hidden} />
          <Stat
            label={prev ? `Since end of ${monthLabel(prev.month, { month: 'short' })}` : 'This month'}
            value={formatINR(prev ? last.net_worth - prev.net_worth : 0)}
            chip={prev && chip(last.net_worth, prev.net_worth)}
            hidden={hidden}
          />
          <Stat
            label={`Since ${monthLabel(first.month, { month: 'short', year: 'numeric' })}`}
            value={formatINR(last.net_worth - first.net_worth)}
            chip={data.length > 1 && chip(last.net_worth, first.net_worth)}
            hidden={hidden}
          />
          <Stat label="Liabilities now" value={formatINR(last.liabilities)} hidden={hidden} />
        </div>

        <Card className="p-5">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2cbcac" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2cbcac" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={hidden ? 8 : 56}
                domain={['auto', 'auto']}
                tickFormatter={(v) => (hidden ? '' : formatCompactINR(v))}
              />
              <Tooltip content={<NetWorthTooltip hidden={hidden} />} />
              <Area type="linear" dataKey="net_worth" name="Net worth" stroke="#2cbcac" strokeWidth={2.5} fill="url(#nw-fill)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <p className="text-xs text-gray-400">Each point is the position at the end of that month; the last one is today.</p>
      </div>

      <AccountHistory owners={owners} />
    </div>
  );
}
