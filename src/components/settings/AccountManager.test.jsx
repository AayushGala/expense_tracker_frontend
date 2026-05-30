import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountManager from './AccountManager';
import {
  MOCK_ACCOUNT_TYPES,
  MOCK_ACCOUNTS,
  MOCK_ALL_DATA,
  MOCK_PAGINATED_ACCOUNT_TYPES,
  createMockApi,
} from '../../test/helpers';

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

let mockApi;

vi.mock('../../api/client', () => ({
  default: new Proxy({}, { get(_, prop) { return mockApi[prop]; } }),
}));

vi.mock('../../hooks/useOwners', () => ({
  useOwners: () => ({ owners: ['Alice', 'Bob'] }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// We need to wrap AccountManager in a DataProvider since it uses useData
import { DataProvider } from '../../context/DataContext';

function renderAccountManager() {
  return render(
    <DataProvider>
      <AccountManager />
    </DataProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountManager', () => {
  beforeEach(() => {
    mockApi = createMockApi();
  });

  it('renders without crashing when accountTypes is an array', async () => {
    renderAccountManager();

    await waitFor(() => {
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });
  });

  it('renders without crashing when accountTypes API returns paginated data', async () => {
    mockApi = createMockApi({
      getAccountTypes: vi.fn().mockResolvedValue(MOCK_PAGINATED_ACCOUNT_TYPES),
    });

    renderAccountManager();

    await waitFor(() => {
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });
  });

  it('renders without crashing when accountTypes is empty', async () => {
    mockApi = createMockApi({
      getAccountTypes: vi.fn().mockResolvedValue([]),
    });

    renderAccountManager();

    await waitFor(() => {
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });
  });

  it('does not crash when accountTypes API fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockApi = createMockApi({
      getAccountTypes: vi.fn().mockRejectedValue(new Error('fail')),
    });

    renderAccountManager();

    await waitFor(() => {
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('displays existing accounts', async () => {
    renderAccountManager();

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
      expect(screen.getByText('ICICI Credit')).toBeInTheDocument();
    });
  });

  it('shows "No accounts yet" when there are no accounts in a group', async () => {
    mockApi = createMockApi({
      getBootstrapData: vi.fn().mockResolvedValue({ ...MOCK_ALL_DATA, accounts: [] }),
    });

    renderAccountManager();

    await waitFor(() => {
      // Each type group card shows its own empty state
      const emptyMessages = screen.getAllByText('No accounts yet.');
      expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows validation error when adding account with empty name', async () => {
    const user = userEvent.setup();
    renderAccountManager();

    await waitFor(() => {
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(mockApi.createAccount).not.toHaveBeenCalled();
  });
});
