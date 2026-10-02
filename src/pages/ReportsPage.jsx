import { useState } from 'react';
import MonthReview from '../components/reports/MonthReview';
import SpendingTrends from '../components/reports/SpendingTrends';
import CashflowReport from '../components/reports/CashflowReport';
import AccountHistory from '../components/reports/AccountHistory';
import ReceivablesReport from '../components/reports/ReceivablesReport';

const TABS = [
  { id: 'review',      label: 'Month in Review' },
  { id: 'spending',    label: 'Spending' },
  { id: 'cashflow',   label: 'Cashflow' },
  { id: 'account',    label: 'Account History' },
  { id: 'receivables',label: 'Receivables' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('review');

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
            onClick={() => setActiveTab(tab.id)}
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

      {/* Tab panels — hidden keeps components mounted to preserve state */}
      <div className="-mt-2">
        <div className={activeTab !== 'review'      ? 'hidden' : ''}><MonthReview /></div>
        <div className={activeTab !== 'spending'    ? 'hidden' : ''}><SpendingTrends /></div>
        <div className={activeTab !== 'cashflow'    ? 'hidden' : ''}><CashflowReport /></div>
        <div className={activeTab !== 'account'     ? 'hidden' : ''}><AccountHistory /></div>
        <div className={activeTab !== 'receivables' ? 'hidden' : ''}><ReceivablesReport /></div>
      </div>
    </div>
  );
}
