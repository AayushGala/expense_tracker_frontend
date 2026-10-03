import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../common/Card';
import MultiSelect from '../common/MultiSelect';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { useMonthReview, useBeneficiaries } from '../../hooks/useReportData';
import { useOwners } from '../../hooks/useOwners';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatINR } from '../../utils/formatters';
import {
  ChangeChip, SectionCard, ShareRow, TopTransactions,
  PACE_MIN_DAY, currentMonthKey, monthLabel, shiftMonth,
} from './insightsUi';

const FILTER_SCHEMA = {
  month: {},
  owners: { array: true },
  beneficiaries: { array: true },
};

const MAX_CHANGES = 4;

/** Drill-down URL carrying the month and owner/beneficiary filters along. */
export function drilldownPath(categoryId, filters) {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', filters.month);
  for (const o of filters.owners ?? []) params.append('owners', o);
  for (const b of filters.beneficiaries ?? []) params.append('beneficiaries', b);
  const q = params.toString();
  return `/reports/categories/${categoryId}${q ? `?${q}` : ''}`;
}

function StatCard({ label, value, previous, average, prevLabel, baselineMonths, goodWhenDown, footer }) {
  const delta = (base) => (base == null ? null : Number(value) - Number(base));
  const pct = (base) => (base ? ((Number(value) - Number(base)) / Math.abs(Number(base))) * 100 : null);
  return (
    <Card className="p-4 flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums text-gray-900">{formatINR(value)}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        {previous != null && (
          <span className="inline-flex items-center gap-1.5">
            vs {prevLabel}
            <ChangeChip change={delta(previous)} pct={pct(previous)} goodWhenDown={goodWhenDown} compact />
          </span>
        )}
        {average != null && (
          <span className="inline-flex items-center gap-1.5">
            vs {baselineMonths}-mo avg
            <ChangeChip change={delta(average)} pct={pct(average)} goodWhenDown={goodWhenDown} compact />
          </span>
        )}
      </div>
      {footer && <div className="text-[11px]">{footer}</div>}
    </Card>
  );
}

export default function MonthReview() {
  const navigate = useNavigate();
  const { owners, ownerOptions } = useOwners();
  const beneficiaryOptions = useBeneficiaries();
  const defaults = useMemo(() => ({ month: currentMonthKey() }), []);
  const [filters, setFilters] = useUrlFilters(FILTER_SCHEMA, defaults);
  const ownerMultiOptions = useMemo(() => ownerOptions.filter((o) => o.value !== ''), [ownerOptions]);

  const apiFilters = useMemo(
    () => ({ owners: filters.owners, beneficiaries: filters.beneficiaries }),
    [filters.owners, filters.beneficiaries],
  );
  const { data, isLoading } = useMonthReview(apiFilters, filters.month);

  const isCurrent = filters.month === currentMonthKey();
  const firstMonth = data?.first_month;
  const canGoBack = !firstMonth || filters.month > firstMonth;

  // Increases and decreases listed separately, so a one-off yearly payment
  // (insurance, tax) dropping out doesn't bury what went up.
  const changes = useMemo(() => {
    if (!data?.average) return { up: [], down: [] };
    const byChange = [...data.categories]
      .filter((c) => c.change != null && Number(c.change) !== 0)
      .sort((a, b) => Number(b.change) - Number(a.change));
    return {
      up: byChange.filter((c) => Number(c.change) > 0).slice(0, MAX_CHANGES),
      down: byChange.filter((c) => Number(c.change) < 0).reverse().slice(0, MAX_CHANGES),
    };
  }, [data]);

  const setMonth = (month) => setFilters((prev) => ({ ...prev, month }));
  const openCategory = (id) => navigate(drilldownPath(id, filters));

  const totals = data?.totals;
  const prevLabel = monthLabel(shiftMonth(filters.month, -1), { month: 'short' });
  const maxGroup = Math.max(0, ...(data?.groups ?? []).map((g) => Number(g.spent)));
  const hasActivity = totals && (Number(totals.spent) > 0 || Number(totals.income) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 min-h-[44px]">
        <div className="flex items-center gap-1 basis-full sm:basis-auto sm:flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(filters.month, -1))}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-gray-900 min-w-[8.5rem] text-center">{monthLabel(filters.month)}</h2>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(filters.month, 1))}
            disabled={isCurrent}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {owners.length > 0 && (
          <MultiSelect
            value={filters.owners}
            onChange={(v) => setFilters((prev) => ({ ...prev, owners: v }))}
            options={ownerMultiOptions}
            placeholder="All Owners"
            singularLabel="owner"
            className="min-w-[130px]"
          />
        )}
        {beneficiaryOptions.length > 0 && (
          <MultiSelect
            value={filters.beneficiaries}
            onChange={(v) => setFilters((prev) => ({ ...prev, beneficiaries: v }))}
            options={beneficiaryOptions}
            placeholder="All Beneficiaries"
            singularLabel="beneficiary"
            className="min-w-[150px]"
          />
        )}
      </div>

      {isLoading && !data ? (
        <div className="py-16 flex items-center justify-center"><LoadingSpinner size="h-8 w-8" /></div>
      ) : !hasActivity ? (
        <Card className="p-6">
          <EmptyState message="Nothing recorded this month" description="Income and expenses for this month will show up here." />
        </Card>
      ) : (
        <>
          {data.pace && data.pace.day >= PACE_MIN_DAY && data.average && (
            <Card className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 bg-gray-50/60">
              <p className="text-sm text-gray-600">
                Day {data.pace.day} of {data.pace.days_in_month}. At this pace you'll spend{' '}
                <span className="font-semibold text-gray-900">{formatINR(data.pace.projected_spent)}</span>
                {' '}this month.
              </p>
              <ChangeChip
                change={Number(data.pace.projected_spent) - Number(data.average.spent)}
                pct={data.average.spent > 0 ? ((data.pace.projected_spent - data.average.spent) / data.average.spent) * 100 : null}
              />
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Spent"
              value={totals.spent}
              previous={data.previous?.spent}
              average={data.average?.spent}
              prevLabel={prevLabel}
              baselineMonths={data.baseline_months}
              goodWhenDown
            />
            <StatCard
              label="Income"
              value={totals.income}
              previous={data.previous?.income}
              average={data.average?.income}
              prevLabel={prevLabel}
              baselineMonths={data.baseline_months}
              goodWhenDown={false}
            />
            <StatCard
              label="Saved"
              value={totals.saved}
              previous={data.previous?.saved}
              average={data.average?.saved}
              prevLabel={prevLabel}
              baselineMonths={data.baseline_months}
              goodWhenDown={false}
              footer={
                <p className="text-gray-400">
                  {totals.savings_rate != null && <>Savings rate <span className="font-semibold text-gray-700">{totals.savings_rate}%</span></>}
                  {Number(totals.invested) > 0 && <> · {formatINR(totals.invested)} invested</>}
                </p>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="Biggest changes"
              subtitle={data.average ? `Compared with your ${data.baseline_months}-month average` : undefined}
            >
              {changes.up.length + changes.down.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">
                  {data.average ? 'Spending is in line with your average.' : 'Comparisons start once there is an earlier month to compare with.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {[['Spending more', changes.up], ['Spending less', changes.down]].map(([heading, rows]) => rows.length > 0 && (
                    <div key={heading}>
                      <p className="text-[11px] font-medium text-gray-500 mt-1">{heading}</p>
                      <div className="divide-y divide-gray-100">
                        {rows.map((c) => (
                          <button
                            key={c.category_id}
                            type="button"
                            onClick={() => openCategory(c.category_id)}
                            className="w-full flex items-center justify-between gap-3 py-2.5 text-left group"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-gray-800 truncate group-hover:text-brand group-hover:underline">{c.name}</p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {formatINR(c.spent)} vs avg {formatINR(c.average)}
                                {c.group !== c.name && <> · {c.group}</>}
                              </p>
                            </div>
                            <ChangeChip change={c.change} pct={c.change_pct} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Where it went" subtitle="Tap a group to dig in">
              <div className="divide-y divide-gray-100">
                {data.groups.filter((g) => Number(g.spent) > 0).map((g) => (
                  <ShareRow
                    key={g.category_id}
                    label={g.name}
                    sublabel={`${g.share}% of spending`}
                    amount={g.spent}
                    max={maxGroup}
                    onClick={() => openCategory(g.category_id)}
                    right={<ChangeChip change={g.change} pct={g.change_pct} compact />}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Largest transactions">
              <TopTransactions transactions={data.top_transactions} />
            </SectionCard>

            {data.new_platforms.length > 0 && data.baseline_months > 0 && (
              <SectionCard title="New this month" subtitle="Places you hadn't spent at before">
                <div className="divide-y divide-gray-100">
                  {data.new_platforms.map((p) => (
                    <div key={p.platform} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 truncate">{p.platform}</p>
                        <p className="text-[11px] text-gray-400">{p.count} transaction{p.count === 1 ? '' : 's'}</p>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums text-gray-900">{formatINR(p.total)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
