// Each validator returns an error message string or null. Compose results
// via collectErrors() into a per-field error map.

export function validateAmount(value, { message = 'Enter a valid positive amount.' } = {}) {
  const parsed = parseFloat(value);
  if (!value || Number.isNaN(parsed) || parsed <= 0) return message;
  return null;
}

export function validateOptionalAmount(value, { message = 'Enter a valid fee amount.' } = {}) {
  if (value === '' || value == null) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return message;
  return null;
}

export function validateDate(value, { message = 'Date is required.' } = {}) {
  if (!value) return message;
  return null;
}

export function validateRequired(value, { message = 'This field is required.' } = {}) {
  if (value == null || value === '') return message;
  return null;
}

export function validateDifferentAccounts(
  fromValue,
  toValue,
  { message = 'Source and destination must be different accounts.' } = {},
) {
  if (fromValue && toValue && String(fromValue) === String(toValue)) return message;
  return null;
}

// Drops entries whose validator returned null/empty.
//   collectErrors({ amount: validateAmount(...), date: validateDate(...) })
export function collectErrors(map) {
  const errs = {};
  for (const [field, result] of Object.entries(map)) {
    if (result) errs[field] = result;
  }
  return errs;
}
