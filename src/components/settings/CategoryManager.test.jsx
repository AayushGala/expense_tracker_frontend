import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryManager from './CategoryManager';
import { MOCK_ALL_DATA, createMockApi } from '../../test/helpers';

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

let mockApi;

vi.mock('../../api/client', () => ({
  default: new Proxy({}, { get(_, prop) { return mockApi[prop]; } }),
}));

import { DataProvider } from '../../context/DataContext';

function renderCategoryManager() {
  return render(
    <DataProvider>
      <CategoryManager />
    </DataProvider>
  );
}

// Categories with parent-child hierarchy
const CATEGORIES_WITH_SUBS = [
  { id: 1, name: 'Food', type: 'expense', parent: null, children: [
    { id: 3, name: 'Groceries', type: 'expense', parent: 1 },
    { id: 4, name: 'Dining Out', type: 'expense', parent: 1 },
  ]},
  { id: 2, name: 'Salary', type: 'income', parent: null, children: [] },
];

// Flat version (as getAllData returns)
const FLAT_CATEGORIES = [
  { id: 1, name: 'Food', type: 'expense', parent: null },
  { id: 2, name: 'Salary', type: 'income', parent: null },
  { id: 3, name: 'Groceries', type: 'expense', parent: 1 },
  { id: 4, name: 'Dining Out', type: 'expense', parent: 1 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoryManager', () => {
  beforeEach(() => {
    mockApi = createMockApi({
      getBootstrapData: vi.fn().mockResolvedValue({
        ...MOCK_ALL_DATA,
        categories: FLAT_CATEGORIES,
      }),
    });
  });

  it('renders parent categories grouped by type', async () => {
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });
  });

  it('renders subcategories nested under parent', async () => {
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Dining Out')).toBeInTheDocument();
    });
  });

  it('shows subcategory count on parent', async () => {
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('2 sub')).toBeInTheDocument();
    });
  });

  it('shows "+ Add Subcategory" button on each parent', async () => {
    renderCategoryManager();

    await waitFor(() => {
      const addSubButtons = screen.getAllByText('+ Add Subcategory');
      expect(addSubButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows add subcategory form when clicking "+ Add Subcategory"', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getAllByText('+ Add Subcategory').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText('+ Add Subcategory')[0]);

    expect(screen.getByPlaceholderText('Subcategory name')).toBeInTheDocument();
  });

  it('calls API with parent id when adding subcategory', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getAllByText('+ Add Subcategory').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText('+ Add Subcategory')[0]);
    await user.type(screen.getByPlaceholderText('Subcategory name'), 'Snacks');

    // Find the Add button in the subcategory form (not the main Add button)
    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    await user.click(addButtons[addButtons.length - 1]);

    await waitFor(() => {
      expect(mockApi.createCategory).toHaveBeenCalledWith({
        name: 'Snacks',
        type: 'expense',
        parent: 1,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Bug fix: newly added subcategory must appear immediately without refresh.
  // The root cause was that the hierarchy builder used `cat.children ?? ...`
  // which short-circuited to the stale API-nested children array, ignoring
  // the locally-dispatched subcategory in the flat list.
  // -----------------------------------------------------------------------

  it('shows newly added subcategory immediately without refresh', async () => {
    // Simulate API response where parent has pre-nested children array (as DRF serializer returns)
    const categoriesWithNestedChildren = [
      { id: 1, name: 'Food', type: 'expense', parent: null, children: [
        { id: 3, name: 'Groceries', type: 'expense', parent: 1 },
      ]},
      { id: 2, name: 'Salary', type: 'income', parent: null, children: [] },
      { id: 3, name: 'Groceries', type: 'expense', parent: 1 },
    ];

    mockApi = createMockApi({
      getBootstrapData: vi.fn().mockResolvedValue({
        ...MOCK_ALL_DATA,
        categories: categoriesWithNestedChildren,
      }),
      createCategory: vi.fn().mockResolvedValue({
        id: 10, name: 'Snacks', type: 'expense', parent: 1,
      }),
    });

    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Add a subcategory
    await user.click(screen.getAllByText('+ Add Subcategory')[0]);
    await user.type(screen.getByPlaceholderText('Subcategory name'), 'Snacks');
    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    await user.click(addButtons[addButtons.length - 1]);

    // Should appear immediately — no refresh needed
    await waitFor(() => {
      expect(screen.getByText('Snacks')).toBeInTheDocument();
    });
  });

  it('shows validation error when adding category with empty name', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Add Category')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: /^add$/i })[0]);
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(mockApi.createCategory).not.toHaveBeenCalled();
  });

  it('calls API to add a top-level category with valid input', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Add Category')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Category name'), 'Travel');
    await user.click(screen.getAllByRole('button', { name: /^add$/i })[0]);

    await waitFor(() => {
      expect(mockApi.createCategory).toHaveBeenCalledWith({ name: 'Travel', type: 'expense' });
    });
  });

  it('shows empty state for a type with no categories', async () => {
    mockApi = createMockApi({
      getBootstrapData: vi.fn().mockResolvedValue({ ...MOCK_ALL_DATA, categories: [] }),
    });

    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('No expense categories yet.')).toBeInTheDocument();
      expect(screen.getByText('No income categories yet.')).toBeInTheDocument();
    });
  });

  it('enters edit mode for parent category when clicking Edit', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Food')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('enters edit mode for subcategory when clicking Edit', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Subcategory Edit buttons come after parent Edit buttons
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    // Click the second Edit (first subcategory)
    await user.click(editButtons[1]);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows delete confirmation for subcategory', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[1]); // subcategory delete

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('calls API to delete subcategory on confirm', async () => {
    const user = userEvent.setup();
    renderCategoryManager();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Click the Delete button closest to "Groceries" (sorted alphabetically: Dining Out, Groceries)
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    // Last subcategory Delete under Food is Groceries (alphabetically after Dining Out)
    await user.click(deleteButtons[2]);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockApi.deleteCategory).toHaveBeenCalledWith(3);
    });
  });
});
