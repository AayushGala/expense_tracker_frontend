import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '../common/Card';
import MultiSelect from '../common/MultiSelect';
import CategoryFilter from '../common/CategoryFilter';
import LoadingSpinner from '../common/LoadingSpinner';
import { useSpendingTrends, useBeneficiaries } from '../../hooks/useReportData';
import { useOwners } from '../../hooks/useOwners';
import { useTransactions } from '../../hooks/useTransactions';
import { useData } from '../../context/DataContext';
import { formatINR, formatDate } from '../../utils/formatters';

function shortMonth(monthKey) {
  const [year, month] = monthKey.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-4 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-accent font-semibold">{formatINR(payload[0].value)}</p>
    </div>
  );
}

export default function SpendingTrends() {
  const { categories } = useData();
  const { owners, ownerOptions } = useOwners();
  const beneficiaryOptions = useBeneficiaries();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedOwners, setSelectedOwners] = useState([]);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState([]);

  const ownerMultiOptions = useMemo(
    () => ownerOptions.filter((o) => o.value !== ''),
    [ownerOptions]
  );

  const trendFilters = useMemo(() => {
    const f = { owners: selectedOwners, beneficiaries: selectedBeneficiaries };
    if (selectedCategoryIds.length > 0) f.categoryIds = selectedCategoryIds;
    return f;
  }, [selectedCategoryIds, selectedOwners, selectedBeneficiaries]);

  const { data: trendData, isLoading: trendLoading } = useSpendingTrends(trendFilters, 12);

  const data = useMemo(
    () => trendData.map((d) => ({ ...d, label: shortMonth(d.month) })),
    [trendData]
  );

  const total = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data]);
  const nonZero = data.filter((d) => d.total > 0);
  const avg = nonZero.length ? total / nonZero.length : 0;
  const peak = useMemo(() => Math.max(0, ...data.map((d) => d.total)), [data]);

  // Transaction list — filtered by type=expense, optionally by categories, owners, beneficiaries
  const txnFilters = useMemo(() => {
    const f = { types: ['expense'] };
    if (selectedCategoryIds.length > 0) f.categoryIds = selectedCategoryIds;
    if (selectedOwners.length > 0) f.owners = selectedOwners;
    if (selectedBeneficiaries.length > 0) f.beneficiaries = selectedBeneficiaries;
    return f;
  }, [selectedCategoryIds, selectedOwners, selectedBeneficiaries]);

  const { transactions: filteredTransactions } = useTransactions(txnFilters, {
    page: 1,
    pageSize: 100,
  });

  const categoryLabel = useMemo(() => {
    if (selectedCategoryIds.length === 0) return null;
    if (selectedCategoryIds.length === 1) {
      return categories.find((c) => c.id === selectedCategoryIds[0])?.name ?? null;
    }
    return `${selectedCategoryIds.length} categories`;
  }, [categories, selectedCategoryIds]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 min-h-[44px]">
        <h2 className="text-base font-bold text-gray-900 flex-1">Spending</h2>
        {owners.length > 0 && (
          <MultiSelect
            value={selectedOwners}
            onChange={setSelectedOwners}
            options={ownerMultiOptions}
            placeholder="All Owners"
            singularLabel="owner"
            className="min-w-[130px]"
          />
        )}
        {beneficiaryOptions.length > 0 && (
          <MultiSelect
            value={selectedBeneficiaries}
            onChange={setSelectedBeneficiaries}
            options={beneficiaryOptions}
            placeholder="All Beneficiaries"
            singularLabel="beneficiary"
            className="min-w-[150px]"
          />
        )}
        <CategoryFilter
          categories={categories}
          value={selectedCategoryIds}
          onChange={setSelectedCategoryIds}
          filterType="expense"
          className="min-w-[180px]"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '12-month total', value: formatINR(total) },
          { label: nonZero.length === data.length ? 'Monthly average' : 'Active-month avg', value: formatINR(avg) },
          { label: 'Peak month', value: formatINR(peak) },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="p-5">
        {categoryLabel && (
          <p className="text-sm font-medium text-gray-600 mb-3">
            Monthly spend — {categoryLabel}
          </p>
        )}
        {trendLoading ? (
          <div className="h-[280px] flex items-center justify-center">
            <LoadingSpinner size="h-8 w-8" />
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#2cbcac"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#2cbcac' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </Card>

      {/* Transaction list */}
      <Card className="p-5">
        <p className="text-sm font-medium text-gray-600 mb-3">
          {categoryLabel ? `${categoryLabel} Transactions` : 'All Expense Transactions'} ({filteredTransactions.length})
        </p>
        {filteredTransactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No transactions found.</p>
        ) : (
          <div className="divide-y divide-gray-100 -mx-5 px-5 max-h-80 overflow-y-auto">
            {filteredTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2.5 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {txn.beneficiary || txn.notes || 'Transaction'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(txn.date)}
                    {txn.categoryNames?.length > 0 && selectedCategoryIds.length === 0 && ` · ${txn.categoryNames[0]}`}
                    {txn.platform && ` · ${txn.platform}`}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                  {formatINR(txn.amount ?? 0)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
