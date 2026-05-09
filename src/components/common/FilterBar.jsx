import { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import api from '../../api/client';
import Dropdown from './Dropdown';
import MultiSelect from './MultiSelect';
import CategoryFilter from './CategoryFilter';
import CalendarPicker from './CalendarPicker';
import { DATE_PRESETS, detectPreset } from '../../utils/datePresets';

const TRANSACTION_TYPES = [
  { value: 'expense',       label: 'Expense' },
  { value: 'income',        label: 'Income' },
  { value: 'transfer',      label: 'Transfer' },
  { value: 'bill_payment',  label: 'Bill Payment' },
  { value: 'investment',    label: 'Investment' },
  { value: 'split_expense', label: 'Split Expense' },
  { value: 'reimbursement', label: 'Reimbursement' },
];

export default function FilterBar({ filters = {}, onChange, onBulkChange, onReset, className = '' }) {
  const { accounts, categories, transactions } = useData();
  const { ownerOptions } = useOwners();

  const accountOptions = accounts
    .filter((a) => !a._removed)
    .map((a) => ({ value: a.id, label: a.name }));

  const categoryIds = filters.categoryIds ?? [];

  const beneficiaryOptions = [...new Set(transactions.map((t) => t.beneficiary).filter(Boolean))]
    .map((b) => ({ value: b, label: b }));

  const [platformList, setPlatformList] = useState([]);
  const [tagList, setTagList] = useState([]);

  useEffect(() => {
    api.getTransactionPlatforms().then((data) => {
      setPlatformList(Array.isArray(data) ? data : (data.results ?? []));
    }).catch(() => {});
    api.getTransactionTags().then((data) => {
      setTagList(Array.isArray(data) ? data : (data.results ?? []));
    }).catch(() => {});
  }, []);

  const platformOptions = platformList.map((p) => ({ value: p, label: p }));
  const tagOptions = tagList.map((t) => ({ value: t, label: t }));
  const ownerMultiOptions = ownerOptions.filter((o) => o.value !== '');

  const hasActiveFilters = Object.values(filters).some((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== '' && v != null;
  });

  return (
    <div className={`flex flex-wrap items-center gap-2.5 py-1 ${className}`}>
      {/* Date preset */}
      <Dropdown
        value={detectPreset(filters.dateFrom, filters.dateTo)}
        placeholder="Custom"
        onChange={(presetKey) => {
          const preset = DATE_PRESETS.find((p) => p.value === presetKey);
          if (!preset) return;
          const { dateFrom, dateTo } = preset.getRange();
          if (onBulkChange) {
            onBulkChange({ dateFrom, dateTo });
          } else {
            onChange('dateFrom', dateFrom);
            onChange('dateTo', dateTo);
          }
        }}
        options={DATE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[140px] sm:flex-none"
      />

      {/* Date range */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto">
        <CalendarPicker
          value={filters.dateFrom ?? ''}
          onChange={(val) => onChange('dateFrom', val)}
          placeholder="From"
          compact
          className="flex-1 sm:flex-none"
        />
        <span className="text-gray-300 text-sm">→</span>
        <CalendarPicker
          value={filters.dateTo ?? ''}
          onChange={(val) => onChange('dateTo', val)}
          placeholder="To"
          min={filters.dateFrom || undefined}
          compact
          className="flex-1 sm:flex-none"
        />
      </div>

      {/* Type */}
      <MultiSelect
        value={filters.types ?? []}
        onChange={(arr) => onChange('types', arr)}
        options={TRANSACTION_TYPES}
        placeholder="All Types"
        singularLabel="type"
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[140px] sm:flex-none"
      />

      {/* Activity (category type) */}
      <Dropdown
        value={filters.categoryType ?? ''}
        onChange={(val) => onChange('categoryType', val)}
        placeholder="All Activity"
        options={[
          { value: '', label: 'All Activity' },
          { value: 'expense', label: 'Spending (incl. refunds)' },
          { value: 'income', label: 'Earning (incl. reversals)' },
        ]}
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[180px] sm:flex-none"
      />

      {/* Account */}
      <MultiSelect
        value={filters.accountIds ?? []}
        onChange={(arr) => onChange('accountIds', arr)}
        options={accountOptions}
        placeholder="All Accounts"
        singularLabel="account"
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[150px] sm:flex-none"
      />

      {/* Category */}
      <CategoryFilter
        categories={categories}
        value={categoryIds}
        onChange={(ids) => onChange('categoryIds', ids)}
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[160px] sm:flex-none"
      />

      {/* Owner */}
      {ownerMultiOptions.length > 0 && (
        <MultiSelect
          value={filters.owners ?? []}
          onChange={(arr) => onChange('owners', arr)}
          options={ownerMultiOptions}
          placeholder="Owner"
          singularLabel="owner"
          className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[120px] sm:flex-none"
        />
      )}

      {/* Platform */}
      <MultiSelect
        value={filters.platforms ?? []}
        onChange={(arr) => onChange('platforms', arr)}
        options={platformOptions}
        placeholder="Platform"
        singularLabel="platform"
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[130px] sm:flex-none"
      />

      {/* Tag */}
      <MultiSelect
        value={filters.tags ?? []}
        onChange={(arr) => onChange('tags', arr)}
        options={tagOptions}
        placeholder="Tag"
        singularLabel="tag"
        className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[120px] sm:flex-none"
      />

      {/* Beneficiary */}
      {beneficiaryOptions.length > 0 && (
        <MultiSelect
          value={filters.beneficiaries ?? []}
          onChange={(arr) => onChange('beneficiaries', arr)}
          options={beneficiaryOptions}
          placeholder="Beneficiary"
          singularLabel="beneficiary"
          className="flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[130px] sm:flex-none"
        />
      )}

      {/* Reset */}
      {onReset && hasActiveFilters && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Reset
        </button>
      )}
    </div>
  );
}
