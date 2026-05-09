import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransactionSummary } from './useTransactionSummary';
import { createMockApi } from '../test/helpers';

let mockApi;

vi.mock('../api/client', () => ({
  default: new Proxy({}, { get(_, prop) { return mockApi[prop]; } }),
}));

describe('useTransactionSummary', () => {
  beforeEach(() => {
    mockApi = createMockApi();
  });

  /** Returns the URLSearchParams instance from the most recent mock call. */
  function lastCallParams() {
    const calls = mockApi.getTransactionSummary.mock.calls;
    return calls[calls.length - 1][0];
  }

  it('calls API with correct query params built from filters', async () => {
    const filters = {
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      types: ['expense'],
      accountIds: [5],
      beneficiaries: ['self'],
      platforms: ['Swiggy'],
      tags: ['food'],
      search: 'coffee',
    };

    renderHook(() => useTransactionSummary(filters));

    await waitFor(() => {
      expect(mockApi.getTransactionSummary).toHaveBeenCalled();
    });
    const params = lastCallParams();
    expect(params.get('date_from')).toBe('2026-01-01');
    expect(params.get('date_to')).toBe('2026-12-31');
    expect(params.get('type')).toBe('expense');
    expect(params.get('account_id')).toBe('5');
    expect(params.get('beneficiary')).toBe('self');
    expect(params.get('platform')).toBe('Swiggy');
    expect(params.get('tag')).toBe('food');
    expect(params.get('search')).toBe('coffee');
    expect(params.get('split_mode')).toBe('my_share');
  });

  it('encodes multi-select arrays as repeated query keys', async () => {
    renderHook(() => useTransactionSummary({
      types: ['expense', 'income'],
      accountIds: [1, 2],
      owners: ['alice', 'bob'],
    }));

    await waitFor(() => {
      expect(mockApi.getTransactionSummary).toHaveBeenCalled();
    });
    const params = lastCallParams();
    expect(params.getAll('type')).toEqual(['expense', 'income']);
    expect(params.getAll('account_id')).toEqual(['1', '2']);
    expect(params.getAll('owner')).toEqual(['alice', 'bob']);
  });

  it('keeps category_ids as a single comma-separated param', async () => {
    renderHook(() => useTransactionSummary({ categoryIds: [1, 2, 3] }));

    await waitFor(() => {
      expect(mockApi.getTransactionSummary).toHaveBeenCalled();
    });
    const params = lastCallParams();
    expect(params.get('category_ids')).toBe('1,2,3');
    expect(params.getAll('category_ids')).toEqual(['1,2,3']);
  });

  it('passes split_mode param', async () => {
    renderHook(() => useTransactionSummary({}, 'total_amount'));

    await waitFor(() => {
      expect(mockApi.getTransactionSummary).toHaveBeenCalled();
    });
    expect(lastCallParams().get('split_mode')).toBe('total_amount');
  });

  it('returns summary data on success', async () => {
    mockApi.getTransactionSummary.mockResolvedValue({
      total_outflow: 1000, total_inflow: 500, net: -500, count: 10,
      transfer_count: 0, transfer_amount: 0,
    });

    const { result } = renderHook(() => useTransactionSummary({}));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.summary).toEqual({
      total_outflow: 1000, total_inflow: 500, net: -500, count: 10,
      transfer_count: 0, transfer_amount: 0,
    });
    expect(result.current.error).toBeNull();
  });

  it('sets error state on API failure', async () => {
    const err = new Error('Network down');
    mockApi.getTransactionSummary.mockRejectedValue(err);

    const { result } = renderHook(() => useTransactionSummary({}));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe(err);
    expect(result.current.summary).toBeNull();
  });
});
