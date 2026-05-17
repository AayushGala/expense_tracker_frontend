/**
 * Interaction helpers for the custom Dropdown component (src/components/common/Dropdown.jsx).
 *
 * The Dropdown isn't a native <select> — it's a button trigger that opens
 * a portal-rendered listbox. Native selectOption() won't work; we click the
 * trigger then click the option.
 */

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger - the dropdown button
 * @param {string|RegExp} optionLabel
 */
export async function pickFromDropdown(page, trigger, optionLabel) {
  await trigger.click();
  // The listbox renders in a portal at the document body level; query the
  // role on the page rather than relative to the trigger.
  await page.getByRole('option', { name: optionLabel }).click();
}

/**
 * Convenience: locate a dropdown by the placeholder/label text it currently
 * displays (e.g. 'Select account', 'Select category', or the existing
 * selection like 'HDFC Savings').
 */
export function dropdownByDisplay(page, currentText) {
  return page.locator('button').filter({ hasText: currentText }).first();
}
