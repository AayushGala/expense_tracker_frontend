import { useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useApiResource } from '../../hooks/useApiResource';
import api from '../../api/client';

/**
 * Refund is a category-driven subtype of income — picking a category with
 * role='refund' flips the form into refund mode. Amount, account, owner,
 * beneficiary, platform, tags are inherited from the source so filters by
 * beneficiary/tags continue to match the refund alongside the original.
 *
 * The source transaction is fetched on demand (it no longer lives in memory).
 */
export function useRefundMode(values, dispatch) {
  const { categories } = useData();

  const refundCategory = categories.find((c) => c.role === 'refund');
  const refundCategoryId = refundCategory ? String(refundCategory.id) : null;
  const isRefundMode = refundCategoryId !== null && values.category_id === refundCategoryId;

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  const srcId = values.source_transaction_id || null;
  const { data: sourceTxn } = useApiResource(
    () => api.getTransaction(srcId),
    [srcId],
    { skip: !srcId },
  );

  const sourceCategoryName = sourceTxn?.category_name ?? '';

  // Avoid submitting a non-refund income with a stale source FK.
  useEffect(() => {
    if (!isRefundMode && values.source_transaction_id) {
      setField('source_transaction_id', null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefundMode]);

  async function handleSourceChange(id) {
    setField('source_transaction_id', id);
    if (!id) {
      setField('amount', '');
      setField('to_account_id', '');
      setField('beneficiary', '');
      setField('platform', '');
      setField('tags', '');
      return;
    }
    try {
      const detail = await api.getTransaction(id);
      // The CREDIT account entry is what left the account in the original expense.
      const creditEntry = (detail.entries ?? [])
        .find((e) => e.entry_type === 'CREDIT' && e.account);
      if (creditEntry) {
        setField('amount', String(creditEntry.amount));
        setField('to_account_id', String(creditEntry.account));
      }
      if (detail.owner) setField('owner', detail.owner);
      setField('beneficiary', detail.beneficiary ?? '');
      setField('platform', detail.platform ?? '');
      setField('tags', detail.tags ?? '');
    } catch {
      /* leave fields as-is on fetch failure */
    }
  }

  return { isRefundMode, sourceTxn, sourceCategoryName, handleSourceChange };
}
