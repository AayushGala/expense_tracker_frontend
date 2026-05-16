/**
 * The `transaction` FK is the source of truth for "is this SMS linked to a
 * transaction." `status` can drift — e.g. if the linked transaction is
 * deleted, Django's SET_NULL nulls the FK but leaves `status='confirmed'`.
 * Anywhere the UI displays a status or decides which actions to show, derive
 * from this helper instead of reading `sms.status` directly.
 */
export function effectiveSmsStatus(sms) {
  if (!sms) return null;
  if (sms.transaction) return 'confirmed';
  if (sms.status === 'confirmed') {
    return sms.parsed_amount != null ? 'parsed' : 'pending';
  }
  return sms.status;
}
