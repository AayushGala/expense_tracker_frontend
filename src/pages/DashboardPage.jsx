import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { sum, ZERO } from '../utils/money';
import { useAccounts } from '../hooks/useAccounts';
import { useHideAmounts } from '../hooks/useHideAmounts';
import { useOwners } from '../hooks/useOwners';
import { useMonthReview } from '../hooks/useReportData';
import { useApiResource } from '../hooks/useApiResource';
import { useData } from '../context/DataContext';
import { useTransactions } from '../hooks/useTransactions';
import api from '../api/client';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import AmountDisplay from '../components/common/AmountDisplay';
import HideAmountsToggle from '../components/common/HideAmountsToggle';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate, formatINR, MASKED_AMOUNT, transactionTypeLabel } from '../utils/formatters';
import TypeIcon, { getVariant } from '../components/common/TypeIcon';
import { drilldownPath } from '../components/reports/MonthReview';
import { ChangeChip, PACE_MIN_DAY, currentMonthKey } from '../components/reports/insightsUi';

const DASHBOARD_FILTER_SCHEMA = {
  beneficiary: {},
  owner:       {},
};
const DASHBOARD_DEFAULTS = { beneficiary: 'All', owner: 'All' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BENEFICIARY_OPTIONS = ['All', 'Self', 'Family'];

// ---------------------------------------------------------------------------
// Beneficiary toggle
// ---------------------------------------------------------------------------

function BeneficiaryToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-0.5">
      {BENEFICIARY_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
            ${value === opt
              ? 'bg-white text-brand shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner toggle
// ---------------------------------------------------------------------------

function OwnerToggle({ value, onChange, options }) {
  if (options.length === 0) return null;
  const allOptions = ['All', ...options];
  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-0.5">
      {allOptions.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
            ${value === opt
              ? 'bg-white text-brand shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NetWorthCard
// ---------------------------------------------------------------------------

function NetWorthCard({ accountsByType, balances, netWorth }) {
  // Balances are Decimals — using `+` on Decimal goes through valueOf() which
  // is a string, so we'd silently get string-concatenation. Sum via the
  // Decimal-aware helper instead.
  const totalOf = (accounts) =>
    sum(accounts.map((a) => balances.get(a.id) ?? ZERO));

  const totalAssets     = totalOf(accountsByType.asset ?? []);
  const totalReceivable = totalOf(accountsByType.receivable ?? []);
  const totalLiability  = totalOf(accountsByType.liability ?? []);
  const [hidden, toggleHidden] = useHideAmounts();

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Net Worth
        </h3>
        <HideAmountsToggle hidden={hidden} onToggle={toggleHidden} />
      </div>

      <div className="flex items-end gap-2">
        <AmountDisplay amount={netWorth} hidden={hidden} className="text-3xl font-bold" />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-[11px] text-gray-400 mb-0.5 font-medium">Assets</p>
          <AmountDisplay amount={totalAssets} variant="income" hidden={hidden} className="text-sm font-bold" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 mb-0.5 font-medium">Liabilities</p>
          <AmountDisplay amount={totalLiability} variant="expense" hidden={hidden} className="text-sm font-bold" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 mb-0.5 font-medium">Receivable</p>
          <AmountDisplay amount={totalReceivable} hidden={hidden} className="text-sm font-bold" />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ThisMonthCard — the top of Month in Review, at a glance
// ---------------------------------------------------------------------------

const TOP_RISES = 3;

function ThisMonthCard({ filters }) {
  const navigate = useNavigate();
  const [hidden] = useHideAmounts();
  const month = currentMonthKey();
  const { data, isLoading } = useMonthReview(filters, month);
  const money = (v) => (hidden ? MASKED_AMOUNT : formatINR(v));

  const rises = useMemo(
    () => (data?.categories ?? [])
      .filter((c) => c.change != null && Number(c.change) > 0)
      .sort((a, b) => Number(b.change) - Number(a.change))
      .slice(0, TOP_RISES),
    [data],
  );

  const avgSpent = data?.average?.spent;
  const projected = data?.pace?.day >= PACE_MIN_DAY ? data.pace.projected_spent : null;

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">This month</h3>
        <Link to="/reports" className="text-xs font-semibold text-accent hover:underline">Month in Review</Link>
      </div>

      {isLoading && !data ? (
        <div className="py-6 flex justify-center"><LoadingSpinner size="h-6 w-6" /></div>
      ) : (
        <>
          <div>
            <p className={`text-3xl font-bold tabular-nums ${hidden ? 'text-gray-400' : 'text-gray-900'}`}>
              {money(data?.totals.spent ?? 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              spent so far
              {data?.pace && <> · day {data.pace.day} of {data.pace.days_in_month}</>}
            </p>
          </div>

          {projected != null && avgSpent != null && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-xs text-gray-600">
                On track for <span className="font-semibold text-gray-900">{money(projected)}</span>
                <span className="text-gray-400"> · usual {money(avgSpent)}</span>
              </p>
              <ChangeChip
                change={Number(projected) - Number(avgSpent)}
                pct={Number(avgSpent) > 0 ? ((projected - avgSpent) / avgSpent) * 100 : null}
                compact
              />
            </div>
          )}

          {rises.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 mb-1 font-medium">Up against your average</p>
              <div className="divide-y divide-gray-50">
                {rises.map((c) => (
                  <button
                    key={c.category_id}
                    type="button"
                    onClick={() => navigate(drilldownPath(c.category_id, { ...filters, month }))}
                    className="w-full flex items-center justify-between gap-3 py-2 text-left group"
                  >
                    <span className="text-[13px] font-medium text-gray-700 truncate group-hover:text-brand group-hover:underline">{c.name}</span>
                    <ChangeChip change={c.change} pct={c.change_pct} compact />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SmsToReview — nudge while parsed SMS wait for confirmation
// ---------------------------------------------------------------------------

const TO_REVIEW_STATUSES = ['pending', 'parsed', 'failed'];

function SmsToReview() {
  const { dataVersion } = useData();
  const { data } = useApiResource(() => {
    const params = new URLSearchParams({ page_size: '1' });
    for (const s of TO_REVIEW_STATUSES) params.append('status', s);
    return api.getSMSMessages(params);
  }, [dataVersion ?? 0]);
  const count = data?.count ?? 0;
  if (count === 0) return null;

  return (
    <Link to="/sms/review" className="block">
      <Card className="px-5 py-3.5 flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 min-w-8 px-2 shrink-0 items-center justify-center rounded-xl bg-accent-light text-sm font-bold text-brand tabular-nums">
            {count}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">SMS to review</p>
            <p className="text-xs text-gray-400">Totals are incomplete until you confirm them.</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-accent shrink-0">Review</span>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// RecentTransactions
// ---------------------------------------------------------------------------

function RecentTransactions({ transactions }) {
  if (transactions.length === 0) {
    return (
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
        </div>
        <EmptyState
          message="No transactions yet"
          description="Add your first transaction to get started."
          className="py-10"
        />
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
        <Link to="/transactions" className="text-xs font-semibold text-accent hover:underline">View all</Link>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-50">
        {transactions.map((txn) => (
          <div key={txn.id} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <TypeIcon type={txn.type} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {txn.notes || transactionTypeLabel(txn.type)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(txn.date)}
                {txn.categoryNames?.length > 0 && ` · ${txn.categoryNames[0]}`}
                {txn.platform && ` · ${txn.platform}`}
              </p>
            </div>
            <AmountDisplay
              amount={txn.amount ?? 0}
              variant={getVariant(txn.type)}
              className="text-sm font-bold flex-shrink-0"
            />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
              <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Description</th>
              <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Category</th>
              <th className="py-3 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Amount</th>
              <th className="py-3 pl-3 pr-5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="py-4 pl-5 pr-3 whitespace-nowrap">
                  <p className="text-sm font-medium text-gray-700">{formatDate(txn.date)}</p>
                </td>
                <td className="py-4 px-3">
                  <div className="flex items-center gap-3">
                    <TypeIcon type={txn.type} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {txn.notes || transactionTypeLabel(txn.type)}
                      </p>
                      {(txn.accountNames?.length > 0 || txn.platform) && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {[txn.accountNames?.join(' · '), txn.platform].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-3 hidden lg:table-cell">
                  {txn.categoryNames?.length > 0 && (
                    <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 uppercase tracking-wide">
                      {txn.categoryNames[0]}
                    </span>
                  )}
                </td>
                <td className="py-4 px-3 text-right whitespace-nowrap">
                  <AmountDisplay
                    amount={txn.amount ?? 0}
                    variant={getVariant(txn.type)}
                    className="text-sm"
                  />
                </td>
                <td className="py-4 pl-3 pr-5 hidden sm:table-cell">
                  <Badge type={txn.type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { isLoading } = useData();
  const { accountsByType, balances, netWorth, getAccountBalance } = useAccounts();
  const { owners } = useOwners();

  // URL-backed so dashboard filters survive reload/share.
  const [dashFilters, setDashFilters] = useUrlFilters(DASHBOARD_FILTER_SCHEMA, DASHBOARD_DEFAULTS);
  const beneficiary = dashFilters.beneficiary;
  const ownerFilter = dashFilters.owner;
  const setBeneficiary = (v) => setDashFilters({ beneficiary: v });
  const setOwnerFilter = (v) => setDashFilters({ owner: v });

  const beneficiaryFilter =
    beneficiary === 'All' ? undefined : beneficiary.toLowerCase();
  const ownerValue =
    ownerFilter === 'All' ? undefined : ownerFilter;

  const reportFilters = useMemo(() => {
    const f = {};
    if (beneficiaryFilter) f.beneficiaries = [beneficiaryFilter];
    if (ownerValue) f.owners = [ownerValue];
    return f;
  }, [beneficiaryFilter, ownerValue]);

  // Filter net worth by owner
  const filteredAccountsByType = useMemo(() => {
    if (!ownerValue) return accountsByType;
    const result = {};
    for (const key of Object.keys(accountsByType)) {
      result[key] = (accountsByType[key] ?? []).filter(
        (a) => a.owner === ownerValue
      );
    }
    return result;
  }, [accountsByType, ownerValue]);

  const filteredNetWorth = useMemo(() => {
    if (!ownerValue) return netWorth;
    const totalOf = (accounts) =>
      sum(accounts.map((a) => getAccountBalance(a.id) ?? ZERO));
    const assets = totalOf(filteredAccountsByType.asset ?? []);
    const receivable = totalOf(filteredAccountsByType.receivable ?? []);
    const liability = totalOf(filteredAccountsByType.liability ?? []);
    return assets.plus(receivable).minus(liability);
  }, [ownerValue, filteredAccountsByType, getAccountBalance, netWorth]);

  const filteredBalances = useMemo(() => {
    if (!ownerValue) return balances;
    // Return only balances for accounts matching the owner
    const filtered = new Map();
    for (const [id, balance] of balances) {
      const allAccounts = [
        ...(accountsByType.asset ?? []),
        ...(accountsByType.liability ?? []),
        ...(accountsByType.receivable ?? []),
      ];
      const account = allAccounts.find((a) => a.id === id);
      if (account?.owner === ownerValue) {
        filtered.set(id, balance);
      }
    }
    return filtered;
  }, [ownerValue, balances, accountsByType]);

  // Recent activity: the most recent page of transactions for the current
  // beneficiary/owner filter (server-paginated, no full in-memory set).
  const { transactions: recentTxns } = useTransactions(reportFilters, {
    page: 1,
    pageSize: 5,
    ordering: '-date',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <LoadingSpinner size="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your financial overview at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OwnerToggle value={ownerFilter} onChange={setOwnerFilter} options={owners} />
          <BeneficiaryToggle value={beneficiary} onChange={setBeneficiary} />
        </div>
      </div>

      <SmsToReview />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NetWorthCard
          accountsByType={filteredAccountsByType}
          balances={filteredBalances}
          netWorth={filteredNetWorth}
        />
        <ThisMonthCard filters={reportFilters} />
      </div>

      <RecentTransactions transactions={recentTxns} />
    </div>
  );
}
