import Decimal from 'decimal.js';

// 28 digits > DB max_digits=14. ROUND_HALF_EVEN avoids upward bias when
// chopping fractional paise.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

export const ZERO = new Decimal(0);

// Casts API strings / numbers / Decimals into a Decimal. Returns ZERO for
// nullish input so reducers don't need to guard.
export function D(value) {
  if (value == null || value === '') return ZERO;
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function sum(values) {
  let total = ZERO;
  for (const v of values) {
    total = total.plus(D(v));
  }
  return total;
}

// Coerces to a plain JS number — only safe for display via chart libs that
// can't accept a Decimal. Loses precision for amounts beyond 2^53.
export function toNumber(d) {
  return D(d).toNumber();
}

export function round2(value) {
  return D(value).toDecimalPlaces(2);
}

export function isPositive(value) {
  return D(value).gt(0);
}

export function abs(value) {
  return D(value).abs();
}

export { Decimal };
