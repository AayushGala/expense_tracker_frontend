import { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import Card from '../common/Card';

export default function OwnerSettings() {
  const { updateSettings } = useData();
  const { owners: currentOwners } = useOwners();

  const [names, setNames] = useState(currentOwners.length > 0 ? currentOwners : ['']);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync from settings if they change externally
  useEffect(() => {
    if (currentOwners.length > 0) {
      setNames(currentOwners);
    }
  }, [currentOwners.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(index, value) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function handleAdd() {
    setNames((prev) => [...prev, '']);
  }

  function handleRemove(index) {
    setNames((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    await updateSettings('owners', cleaned.join(','));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 hover:border-gray-300 placeholder-gray-400';

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100 mb-4">
          <h3 className="text-base font-bold text-gray-800">Account Owners</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Add the people sharing this tracker. These names will appear in owner
            dropdowns across accounts, transactions, and reports.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {names.map((name, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => handleChange(index, e.target.value)}
                placeholder={`Person ${index + 1}`}
                className={inputClass}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={handleAdd}
            className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-brand rounded-lg px-2 py-1.5 hover:bg-accent-light/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Person
          </button>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saved && (
            <span className="text-xs text-emerald-600 font-medium">
              Saved!
            </span>
          )}
        </div>
      </Card>

      {/* Owner guide */}
      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100 mb-4">
          <h3 className="text-base font-bold text-gray-800">Owner Guide</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Who should be set as the owner for each transaction type.
          </p>
        </div>
        <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Transaction Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Owner should be</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Expense', 'Who the expense belongs to (not necessarily who paid)'],
                ['Income', 'Who earned it (e.g. whose salary, whose refund)'],
                ['Transfer', 'Either person or blank — it\'s just money moving'],
                ['Bill Payment', 'Who the credit card/loan belongs to'],
                ['Investment', 'Who the investment is for'],
                ['Cashback', 'Who earned the reward (whose card/purchase triggered it)'],
                ['Split Expense', 'Who paid the bill upfront'],
                ['Reimbursement', 'Who is receiving the money back'],
              ].map(([type, desc]) => (
                <tr key={type} className="bg-white">
                  <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">{type}</td>
                  <td className="px-4 py-2.5 text-gray-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
