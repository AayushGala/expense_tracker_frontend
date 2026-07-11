// ISO date strings compare correctly as strings, so no Date parsing needed.
export function isDateClosed(date, closedThrough) {
  return Boolean(closedThrough && date && date <= closedThrough);
}

// Default close date suggestion: the last day of the previous month.
export function lastMonthEnd(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), 0);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
