// Single source of truth for mapping the frontend filter object to the
// backend's TransactionFilterSet query params (repeated keys for multi-value
// filters: ?type=expense&type=income). Used by the transaction list, summary,
// and every report/aggregate fetch so the filter bar is respected everywhere.

export function buildTransactionParams(filters = {}, extra = {}) {
  const params = new URLSearchParams();

  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const appendEach = (key, values) => {
    if (!values || values.length === 0) return;
    for (const v of values) params.append(key, v);
  };

  appendEach('type', filters.types);
  appendEach('account_id', filters.accountIds);
  appendEach('beneficiary', filters.beneficiaries);
  appendEach('owner', filters.owners);
  appendEach('platform', filters.platforms);
  appendEach('tag', filters.tags);

  // category_ids stays a single CSV param — the backend filterset special-cases
  // it (matches txn.category OR an entry's category).
  if (filters.categoryIds?.length > 0) {
    params.set('category_ids', filters.categoryIds.join(','));
  }
  if (filters.categoryType) params.set('category_type', filters.categoryType);
  if (filters.search) params.set('search', filters.search);

  // Non-filter extras: page, ordering, months, month, page_size, split_mode…
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  return params;
}
