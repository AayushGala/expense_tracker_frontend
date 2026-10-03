import { useNavigate } from 'react-router-dom';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { useGroupTrends } from '../../hooks/useReportData';
import { formatINR } from '../../utils/formatters';
import { drilldownPath } from './MonthReview';
import { ChangeChip, currentMonthKey, formatCompactINR, monthLabel } from './insightsUi';

const MONTHS = 12;

/** Cell shade relative to the row's own peak, so every group shows its highs. */
function shade(value, peak) {
  const v = Number(value);
  if (!v || peak <= 0) return undefined;
  const alpha = 0.08 + 0.5 * (v / peak);
  return { backgroundColor: `rgba(44, 188, 172, ${alpha.toFixed(2)})` };
}

function Row({ name, summary, months, onName, onCell, strong }) {
  const peak = Math.max(0, ...summary.totals.map(Number));
  return (
    <tr className={strong ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}>
      <th scope="row" className={`sticky left-0 z-10 text-left px-3 py-2 ${strong ? 'bg-gray-50' : 'bg-white'}`}>
        {onName ? (
          <button type="button" onClick={onName} className="text-[13px] font-medium text-gray-800 hover:text-brand hover:underline text-left whitespace-nowrap">
            {name}
          </button>
        ) : (
          <span className="text-[13px] font-semibold text-gray-900 whitespace-nowrap">{name}</span>
        )}
      </th>
      {summary.totals.map((v, i) => (
        <td key={months[i]} className="p-0.5">
          <button
            type="button"
            disabled={!onCell || !Number(v)}
            onClick={() => onCell?.(months[i])}
            title={`${monthLabel(months[i])}: ${formatINR(v)}`}
            style={shade(v, peak)}
            className={`w-full rounded-md px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap ${
              Number(v) ? 'text-gray-800' : 'text-gray-300'
            } ${strong ? 'font-semibold' : ''} enabled:hover:ring-1 enabled:hover:ring-brand/40`}
          >
            {Number(v) ? formatCompactINR(v) : '–'}
          </button>
        </td>
      ))}
      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-gray-900 whitespace-nowrap">
        {summary.average != null ? formatCompactINR(summary.average) : '–'}
      </td>
      <td className="px-3 py-2 text-right">
        {summary.recent_change_pct != null && (
          <ChangeChip change={summary.recent_change_pct} pct={summary.recent_change_pct} compact />
        )}
      </td>
    </tr>
  );
}

export default function TrendsReport({ filters }) {
  const navigate = useNavigate();
  const apiFilters = { owners: filters.owners, beneficiaries: filters.beneficiaries };
  const { data, isLoading } = useGroupTrends(apiFilters, MONTHS);

  if (isLoading && !data) {
    return <div className="py-16 flex justify-center"><LoadingSpinner size="h-8 w-8" /></div>;
  }
  if (!data?.groups?.length) {
    return <Card className="p-6"><EmptyState message="No spending yet" description="Trends appear once you have expenses." /></Card>;
  }

  const months = data.months;
  const current = currentMonthKey();
  const open = (categoryId, month) =>
    navigate(drilldownPath(categoryId, { ...filters, month: month ?? undefined }));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 min-h-[44px]">
        <h2 className="text-base font-bold text-gray-900">Spending by group</h2>
        <p className="hidden sm:block text-xs text-gray-400">Darker = a bigger month for that group</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="sticky left-0 z-10 bg-white text-left px-3 py-3">Group</th>
                {months.map((m) => (
                  <th key={m} className="px-2 py-3 text-right whitespace-nowrap">
                    {monthLabel(m, { month: 'short' })}
                    {m === current && <span className="block text-[9px] normal-case tracking-normal font-medium">so far</span>}
                  </th>
                ))}
                <th className="px-3 py-3 text-right whitespace-nowrap">Avg / mo</th>
                <th className="px-3 py-3 text-right whitespace-nowrap" title="Last 3 complete months against the average">Last 3 mo</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <Row
                  key={g.category_id}
                  name={g.name}
                  summary={g}
                  months={months}
                  onName={() => open(g.category_id)}
                  onCell={(m) => open(g.category_id, m)}
                />
              ))}
              <Row name="Total" summary={data.total} months={months} strong />
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-gray-400">
        Averages use complete months only. "Last 3 mo" compares your last three complete months with that average. Tap a group or a month to dig in.
      </p>
    </div>
  );
}
