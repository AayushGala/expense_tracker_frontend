import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import Card from '../common/Card';
import Dropdown from '../common/Dropdown';
import { useAccounts } from '../../hooks/useAccounts';
import { useApiResource } from '../../hooks/useApiResource';
import api from '../../api/client';
import { useData } from '../../context/DataContext';
import { formatINR, formatDate } from '../../utils/formatters';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-4 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-accent font-semibold">{formatINR(payload[0].value)}</p>
    </div>
  );
}

export default function AccountHistory() {
  const { accounts, getAccountBalance } = useAccounts();
  const { dataVersion } = useData();

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '');

  const { data: ledgerData } = useApiResource(
    () => api.getAccountLedger(selectedAccountId),
    [selectedAccountId, dataVersion ?? 0],
    { skip: !selectedAccountId },
  );

  // Server returns running_balance (snake); the chart/table expect runningBalance.
  const ledger = useMemo(
    () => (ledgerData?.entries ?? []).map((e) => ({ ...e, runningBalance: e.running_balance })),
    [ledgerData]
  );

  const chartData = useMemo(
    () =>
      ledger.map((entry) => ({
        label: formatDate(entry.date),
        balance: entry.runningBalance,
        date: entry.date,
      })),
    [ledger]
  );

  const currentBalance = selectedAccountId ? getAccountBalance(selectedAccountId) : 0;

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const minBalance = chartData.length
    ? Math.min(...chartData.map((d) => d.balance))
    : 0;
  const maxBalance = chartData.length
    ? Math.max(...chartData.map((d) => d.balance))
    : 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 min-h-[44px]">
        <h2 className="text-base font-bold text-gray-900 flex-1">Account History</h2>
        <Dropdown
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          options={
            accounts.length === 0
              ? [{ value: '', label: 'No accounts' }]
              : accounts.map((a) => ({ value: a.id, label: a.name }))
          }
          className="min-w-[180px]"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Current Balance</p>
          <p className={`text-base font-bold mt-0.5 ${currentBalance >= 0 ? 'text-gray-900' : 'text-gray-800'}`}>
            {formatINR(currentBalance)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Lowest Balance</p>
          <p className={`text-base font-bold mt-0.5 ${minBalance >= 0 ? 'text-gray-900' : 'text-gray-800'}`}>
            {formatINR(minBalance)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Highest Balance</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">{formatINR(maxBalance)}</p>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-5">
        <p className="text-sm font-medium text-gray-600 mb-3">
          Balance over time — {selectedAccount?.name ?? ''}
        </p>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            No transactions found for this account.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              {minBalance < 0 && <ReferenceLine y={0} stroke="#1e2a30" strokeDasharray="4 4" />}
              <Line
                type="stepAfter"
                dataKey="balance"
                stroke="#2cbcac"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent ledger entries */}
      {ledger.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-600 mb-3">
            Recent entries ({ledger.length})
          </p>
          <div className="divide-y divide-gray-100 -mx-6 px-6 max-h-80 overflow-y-auto">
            {[...ledger].reverse().map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2.5 gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
                  <p className="text-xs text-gray-500">{entry.entry_type}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${entry.entry_type === 'DEBIT' ? 'text-accent' : 'text-gray-800'}`}>
                    {entry.entry_type === 'DEBIT' ? '-' : '+'}{formatINR(entry.amount)}
                  </p>
                  <p className="text-xs text-gray-400">Bal: {formatINR(entry.runningBalance)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
