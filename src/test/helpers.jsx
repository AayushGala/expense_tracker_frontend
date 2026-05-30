import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataProvider } from '../context/DataContext';

// ---------------------------------------------------------------------------
// Mock API data
// ---------------------------------------------------------------------------

export const MOCK_ACCOUNT_TYPES = [
  {
    id: 1,
    name: 'asset',
    label: 'Asset',
    sub_types: [
      { id: 1, name: 'bank', label: 'Bank Account', account_type: 1 },
      { id: 2, name: 'cash', label: 'Cash', account_type: 1 },
    ],
  },
  {
    id: 2,
    name: 'liability',
    label: 'Liability',
    sub_types: [
      { id: 3, name: 'credit_card', label: 'Credit Card', account_type: 2 },
    ],
  },
];

export const MOCK_PAGINATED_ACCOUNT_TYPES = {
  count: 2,
  next: null,
  previous: null,
  results: MOCK_ACCOUNT_TYPES,
};

export const MOCK_ACCOUNTS = [
  { id: 1, name: 'HDFC Savings', type: 'asset', sub_type: 'bank', is_active: true },
  { id: 2, name: 'ICICI Credit', type: 'liability', sub_type: 'credit_card', is_active: true },
];

export const MOCK_CATEGORIES = [
  { id: 1, name: 'Food', type: 'expense' },
  { id: 2, name: 'Salary', type: 'income' },
];

export const MOCK_ALL_DATA = {
  accounts: MOCK_ACCOUNTS,
  categories: MOCK_CATEGORIES,
  transactions: [],
  entries: [],
  receivables: [],
  budgets: [],
  settings: {},
};

// The app bootstrap payload (no transactions/entries/budgets).
export const MOCK_BOOTSTRAP = {
  account_types: MOCK_ACCOUNT_TYPES,
  accounts: MOCK_ACCOUNTS,
  categories: MOCK_CATEGORIES,
  receivables: [],
  settings: {},
};

// ---------------------------------------------------------------------------
// Create a mock api module
// ---------------------------------------------------------------------------

export function createMockApi(overrides = {}) {
  return {
    getBootstrapData: vi.fn().mockResolvedValue(MOCK_BOOTSTRAP),
    getAllData: vi.fn().mockResolvedValue(MOCK_ALL_DATA),
    getAccountTypes: vi.fn().mockResolvedValue(MOCK_ACCOUNT_TYPES),
    createAccountType: vi.fn().mockResolvedValue({ id: 99, name: 'test', label: 'Test', sub_types: [] }),
    updateAccountType: vi.fn().mockResolvedValue({}),
    deleteAccountType: vi.fn().mockResolvedValue(null),
    createAccountSubType: vi.fn().mockResolvedValue({ id: 99, name: 'test_sub', label: 'Test Sub', account_type: 1 }),
    updateAccountSubType: vi.fn().mockResolvedValue({}),
    deleteAccountSubType: vi.fn().mockResolvedValue(null),
    getAccounts: vi.fn().mockResolvedValue(MOCK_ACCOUNTS),
    createAccount: vi.fn().mockResolvedValue({ id: 99, name: 'New Account', type: 'asset', sub_type: 'bank', is_active: true }),
    updateAccount: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    deleteAccount: vi.fn().mockResolvedValue(null),
    getCategories: vi.fn().mockResolvedValue(MOCK_CATEGORIES),
    createCategory: vi.fn().mockResolvedValue({ id: 99, name: 'New Cat', type: 'expense' }),
    updateCategory: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    deleteCategory: vi.fn().mockResolvedValue(null),
    getTransactions: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
    getTransaction: vi.fn().mockResolvedValue({ id: 1, entries: [], receivables: [], linked_refunds: [], source_transaction_detail: null }),
    getTransactionSummary: vi.fn().mockResolvedValue({
      total_outflow: 0, total_inflow: 0, net: 0, count: 0,
      transfer_count: 0, transfer_amount: 0,
    }),
    getTransactionsCSV: vi.fn().mockResolvedValue(new Blob([''], { type: 'text/csv' })),
    getTransactionTags: vi.fn().mockResolvedValue([]),
    getTransactionPlatforms: vi.fn().mockResolvedValue([]),
    getTagCounts: vi.fn().mockResolvedValue([]),
    getBeneficiaries: vi.fn().mockResolvedValue([]),
    getMonthlySpending: vi.fn().mockResolvedValue({ data: [] }),
    getCategoryBreakdown: vi.fn().mockResolvedValue({ month: '', data: [] }),
    getCashflow: vi.fn().mockResolvedValue({ data: [] }),
    getSpendingTrends: vi.fn().mockResolvedValue({ data: [] }),
    getAccountBalances: vi.fn().mockResolvedValue({ balances: [], net_worth: '0', by_type: { asset: '0', liability: '0', receivable: '0' } }),
    getAccountLedger: vi.fn().mockResolvedValue({ account_id: null, type: null, entries: [] }),
    getReceivablesRollup: vi.fn().mockResolvedValue({ total_owed: 0, by_person: [] }),
    createTransaction: vi.fn().mockResolvedValue({ id: 1, entries: [], receivables: [] }),
    updateTransaction: vi.fn().mockResolvedValue({ id: 1, entries: [] }),
    deleteTransaction: vi.fn().mockResolvedValue(null),
    getReceivables: vi.fn().mockResolvedValue([]),
    updateReceivable: vi.fn().mockResolvedValue({}),
    getBudgets: vi.fn().mockResolvedValue([]),
    createBudget: vi.fn().mockResolvedValue({}),
    updateBudget: vi.fn().mockResolvedValue({}),
    deleteBudget: vi.fn().mockResolvedValue(null),
    getSettings: vi.fn().mockResolvedValue({}),
    updateSetting: vi.fn().mockResolvedValue({}),
    getToken: vi.fn().mockReturnValue('mock-token'),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helper with providers
// ---------------------------------------------------------------------------

export function renderWithProviders(ui, options = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        {children}
      </MemoryRouter>
    ),
    ...options,
  });
}
