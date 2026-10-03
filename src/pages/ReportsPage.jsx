import { useMemo } from 'react';
import MultiSelect from '../components/common/MultiSelect';
import MonthReview from '../components/reports/MonthReview';
import TrendsReport from '../components/reports/TrendsReport';
import CashflowReport from '../components/reports/CashflowReport';
import NetWorthReport from '../components/reports/NetWorthReport';
import { currentMonthKey } from '../components/reports/insightsUi';
import { useBeneficiaries } from '../hooks/useReportData';
import { useOwners } from '../hooks/useOwners';
import { useUrlFilters } from '../hooks/useUrlFilters';

const TABS = [
  { id: 'review',   label: 'Month in Review' },
  { id: 'trends',   label: 'Trends' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'networth', label: 'Net Worth' },
];

// One URL-backed filter set for the whole page: the tab, the reviewed month
// and the owner/beneficiary filters survive reloads, tab switches and the
// round trip through a category drill-down.
const FILTER_SCHEMA = {
  tab: {},
  month: {},
  owners: { array: true },
  beneficiaries: { array: true },
};

export default function ReportsPage() {
  const defaults = useMemo(() => ({ tab: 'review', month: currentMonthKey() }), []);
  const [filters, setFilters] = useUrlFilters(FILTER_SCHEMA, defaults);
  const { owners, ownerOptions } = useOwners();
  const beneficiaryOptions = useBeneficiaries();
  const ownerMultiOptions = useMemo(() => ownerOptions.filter((o) => o.value !== ''), [ownerOptions]);

  const activeTab = TABS.some((t) => t.id === filters.tab) ? filters.tab : 'review';
  const update = (partial) => setFilters((prev) => ({ ...prev, ...partial }));
  // Net worth is account-based: beneficiary has no meaning there.
  const showBeneficiaries = activeTab !== 'networth' && beneficiaryOptions.length > 0;

  return (
    <div className="space-y-6">
      {/* Header — hidden on mobile (TopBar shows title) */}
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-1">Analyse your financial data over time.</p>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto scrollbar-none gap-0.5 sm:gap-1 border-b border-gray-200 -mx-4 px-4 md:mx-0 md:px-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => update({ tab: tab.id })}
            className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(owners.length > 0 || showBeneficiaries) && (
        <div className="-mt-2 flex flex-wrap items-center gap-3">
          {owners.length > 0 && (
            <MultiSelect
              value={filters.owners}
              onChange={(v) => update({ owners: v })}
              options={ownerMultiOptions}
              placeholder="All Owners"
              singularLabel="owner"
              className="min-w-[130px]"
            />
          )}
          {showBeneficiaries && (
            <MultiSelect
              value={filters.beneficiaries}
              onChange={(v) => update({ beneficiaries: v })}
              options={beneficiaryOptions}
              placeholder="All Beneficiaries"
              singularLabel="beneficiary"
              className="min-w-[150px]"
            />
          )}
        </div>
      )}

      <div className="-mt-2">
        {activeTab === 'review' && <MonthReview filters={filters} onChange={update} />}
        {activeTab === 'trends' && <TrendsReport filters={filters} />}
        {activeTab === 'cashflow' && <CashflowReport filters={filters} />}
        {activeTab === 'networth' && <NetWorthReport owners={filters.owners} />}
      </div>
    </div>
  );
}
