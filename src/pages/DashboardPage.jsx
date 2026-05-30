import { useState, useMemo } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { sum, ZERO } from '../utils/money';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAccounts } from '../hooks/useAccounts';
import { useOwners } from '../hooks/useOwners';
import { useMonthlySpending, useCategoryBreakdown, useReceivablesRollup } from '../hooks/useReportData';
import { useData } from '../context/DataContext';
import { useTransactions } from '../hooks/useTransactions';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import AmountDisplay from '../components/common/AmountDisplay';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate, formatINR, transactionTypeLabel } from '../utils/formatters';
import TypeIcon, { getVariant } from '../components/common/TypeIcon';

const DASHBOARD_FILTER_SCHEMA = {
  beneficiary: {},
  owner:       {},
};
const DASHBOARD_DEFAULTS = { beneficiary: 'All', owner: 'All' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BENEFICIARY_OPTIONS = ['All', 'Self', 'Family'];

const PIE_COLORS = [
  '#1e2a30', '#2cbcac', '#7c9ea6', '#c5f1ec',
  '#4a6670', '#a8d8d0', '#34495e', '#5dade2',
  '#85929e', '#48c9b0', '#2c3e50', '#76d7c4',
];

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

  return (
    <Card className="p-6 flex flex-col gap-4">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Net Worth
      </h3>

      <div className="flex items-end gap-2">
        <AmountDisplay amount={netWorth} className="text-3xl font-bold" />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-[11px] text-gray-400 mb-0.5 font-medium">Assets</p>
          <AmountDisplay amount={totalAssets} variant="income" className="text-sm font-bold" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 mb-0.5 font-medium">Liabilities</p>
          <AmountDisplay amount={totalLiability} variant="expense" className="text-sm font-bold" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 mb-0.5 font-medium">Receivable</p>
          <AmountDisplay amount={totalReceivable} className="text-sm font-bold" />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MonthlySpendingChart
// ---------------------------------------------------------------------------

function MonthlySpendingChart({ data, isLoading }) {
  if (isLoading) {
    return (
      <Card className="p-6 flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Monthly Spending — Last 6 Months
        </h3>
        <div className="h-[200px] flex items-center justify-center">
          <LoadingSpinner size="h-8 w-8" />
        </div>
      </Card>
    );
  }
  if (!data || data.every((d) => d.total === 0)) {
    return (
      <Card className="p-6 flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Monthly Spending
        </h3>
        <EmptyState
          message="No spending data yet"
          description="Add some expense transactions to see your chart."
          className="py-10"
        />
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.month + '-02').toLocaleDateString('en-IN', { month: 'short' }),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl bg-white ring-1 ring-gray-200 shadow-lg px-3 py-2 text-sm">
        <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
        <p className="text-accent font-bold">{formatINR(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <Card className="p-6 flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Monthly Spending — Last 6 Months
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
          <Bar dataKey="total" fill="#1e2a30" radius={[8, 8, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CategoryPieChart
// ---------------------------------------------------------------------------

function CategoryPieChart({ data, isLoading }) {
  if (isLoading) {
    return (
      <Card className="p-6 flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          This Month by Category
        </h3>
        <div className="h-[240px] flex items-center justify-center">
          <LoadingSpinner size="h-8 w-8" />
        </div>
      </Card>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          This Month by Category
        </h3>
        <EmptyState
          message="No category data"
          description="Add expense transactions this month to see the breakdown."
          className="py-10"
        />
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl bg-white ring-1 ring-gray-200 shadow-lg px-3 py-2 text-sm">
        <p className="font-semibold text-gray-700">{payload[0].name}</p>
        <p className="text-accent font-bold">{formatINR(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <Card className="p-6 flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        This Month by Category
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-500 font-medium">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
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
        <p className="text-xs text-gray-400">{transactions.length} of {transactions.length}</p>
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
// ReceivablesSummary
// ---------------------------------------------------------------------------

function ReceivablesSummary({ summary }) {
  const { totalOwed, byPerson } = summary;

  return (
    <Card className="p-6 flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Receivables
      </h3>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">Total owed to you</p>
        <AmountDisplay amount={totalOwed} variant="income" className="text-lg font-bold" />
      </div>

      {byPerson.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Nothing outstanding</p>
      ) : (
        <ul className="divide-y divide-gray-100 -mx-6 px-6 mt-1">
          {byPerson.map(({ person, amount }) => (
            <li key={person} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-light flex items-center justify-center text-xs font-bold text-brand uppercase flex-shrink-0">
                  {person.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-700">{person}</span>
              </div>
              <AmountDisplay amount={amount} variant="income" className="text-sm" />
            </li>
          ))}
        </ul>
      )}
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

  const { data: spendingData, isLoading: spendingLoading } = useMonthlySpending(reportFilters, 6);
  const { data: categoryData, isLoading: categoryLoading } = useCategoryBreakdown(reportFilters);
  const receivables = useReceivablesRollup();

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
    pageSize: 15,
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

      {/* Top row: net worth + spending chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NetWorthCard
          accountsByType={filteredAccountsByType}
          balances={filteredBalances}
          netWorth={filteredNetWorth}
        />
        <MonthlySpendingChart data={spendingData} isLoading={spendingLoading} />
      </div>

      {/* Middle row: pie chart + receivables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CategoryPieChart data={categoryData} isLoading={categoryLoading} />
        <ReceivablesSummary summary={receivables} />
      </div>

      {/* Bottom: recent transactions (full width) */}
      <RecentTransactions transactions={recentTxns} />
    </div>
  );
}
