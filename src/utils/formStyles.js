export const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 hover:border-gray-300 placeholder-gray-400';
export const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5';
export const errorClass = 'mt-1.5 text-xs text-rose-500 font-medium';

/** Format account for dropdown: "Name · Owner" or just "Name" if no owner */
export function accountOption(a) {
  const label = a.owner ? `${a.name} · ${a.owner}` : a.name;
  return { value: String(a.id), label };
}

/**
 * Build hierarchical category options for dropdowns.
 * Parents with children become group headers (indented children below).
 * Parents without children are selectable directly.
 */
export function categoryOptions(categories) {
  // Separate parents and children
  const parents = categories.filter((c) => !c.parent && !c.parent_id);
  const childrenMap = new Map();
  for (const cat of categories) {
    const parentId = cat.parent ?? cat.parent_id;
    if (parentId) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId).push(cat);
    }
  }

  const options = [];
  // Role-tagged categories (Cashback / Refund) sort first; rest alphabetical.
  const sorted = [...parents].sort((a, b) => {
    const aRole = a.role ? 0 : 1;
    const bRole = b.role ? 0 : 1;
    if (aRole !== bRole) return aRole - bRole;
    return a.name.localeCompare(b.name);
  });

  for (const parent of sorted) {
    const children = (childrenMap.get(parent.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (children.length > 0) {
      // Parent as a non-selectable group header
      options.push({ value: `__group_${parent.id}`, label: parent.name, disabled: true });
      for (const child of children) {
        options.push({ value: String(child.id), label: `  ${child.name}` });
      }
    } else {
      // No children — parent is selectable
      options.push({ value: String(parent.id), label: parent.name });
    }
  }

  return options;
}
