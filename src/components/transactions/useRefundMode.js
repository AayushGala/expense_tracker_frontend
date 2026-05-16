import { useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';

/**
 * Refund is a category-driven subtype of income — picking a category with
 * role='refund' flips the form into refund mode. Amount, account, owner,
 * beneficiary, platform, tags are inherited from the source so filters by
 * beneficiary/tags continue to match the refund alongside the original.
 */
export function useRefundMode(values, dispatch) {
  const { categories, transactions, entries } = useData();

  const refundCategory = useMemo(
    () => categories.find((c) => c.role === 'refund'),
    [categories],
  );
  const refundCategoryId = refundCategory ? String(refundCategory.id) : null;
  const isRefundMode = refundCategoryId !== null && values.category_id === refundCategoryId;

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  const entriesByTxn = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!map.has(e.transaction_id)) map.set(e.transaction_id, []);
      map.get(e.transaction_id).push(e);
    }
    return map;
  }, [entries]);

  const sourceTxn = useMemo(() => {
    if (!values.source_transaction_id) return null;
    return transactions.find((t) => t.id === values.source_transaction_id) ?? null;
  }, [transactions, values.source_transaction_id]);

  const sourceCategoryName = useMemo(() => {
    if (!sourceTxn) return '';
    const cat = categories.find((c) => c.id === sourceTxn.category_id);
    return cat?.name ?? '';
  }, [sourceTxn, categories]);

  // Avoid submitting a non-refund income with a stale source FK.
  useEffect(() => {
    if (!isRefundMode && values.source_transaction_id) {
      setField('source_transaction_id', null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefundMode]);

  function handleSourceChange(id) {
    setField('source_transaction_id', id);
    if (!id) {
      setField('amount', '');
      setField('to_account_id', '');
      setField('beneficiary', '');
      setField('platform', '');
      setField('tags', '');
      return;
    }
    const sourceTxnPicked = transactions.find((t) => t.id === id);
    const creditEntry = (entriesByTxn.get(id) ?? [])
      .find((e) => e.entry_type === 'CREDIT' && e.account_id);
    if (creditEntry) {
      setField('amount', String(creditEntry.amount));
      setField('to_account_id', String(creditEntry.account_id));
    }
    if (sourceTxnPicked) {
      if (sourceTxnPicked.owner) setField('owner', sourceTxnPicked.owner);
      setField('beneficiary', sourceTxnPicked.beneficiary ?? '');
      setField('platform', sourceTxnPicked.platform ?? '');
      setField('tags', sourceTxnPicked.tags ?? '');
    }
  }

  return { isRefundMode, sourceTxn, sourceCategoryName, handleSourceChange };
}
