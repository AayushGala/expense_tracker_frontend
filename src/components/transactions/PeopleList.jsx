import { inputClass, errorClass } from '../../utils/formStyles';

// Not persisted — used only as a React key for the row's lifetime.
function makeId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function PeopleList({
  people,
  errors = {},
  listError,
  onChange,
}) {
  function add() {
    onChange([...(people ?? []), { id: makeId(), name: '', amount: '' }]);
  }

  function remove(id) {
    onChange((people ?? []).filter((p) => p.id !== id));
  }

  function update(id, field, value) {
    onChange((people ?? []).map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">Other People</p>
        <button
          type="button"
          onClick={add}
          className="min-h-[44px] px-3 text-xs font-medium text-accent hover:text-brand rounded-lg hover:bg-accent-light transition-colors"
        >
          + Add Person
        </button>
      </div>

      <div className="space-y-2">
        {(people ?? []).map((person, idx) => (
          <div key={person.id} className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Person name"
                value={person.name}
                onChange={(e) => update(person.id, 'name', e.target.value)}
                className={`${inputClass} ${errors[`person_name_${idx}`] ? 'border-red-400' : ''}`}
              />
              {errors[`person_name_${idx}`] && (
                <p className={errorClass}>{errors[`person_name_${idx}`]}</p>
              )}
            </div>
            <div className="w-28">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="₹ amount"
                value={person.amount}
                onChange={(e) => update(person.id, 'amount', e.target.value)}
                className={`${inputClass} ${errors[`person_amount_${idx}`] ? 'border-red-400' : ''}`}
              />
              {errors[`person_amount_${idx}`] && (
                <p className={errorClass}>{errors[`person_amount_${idx}`]}</p>
              )}
            </div>
            {(people?.length ?? 0) > 1 && (
              <button
                type="button"
                onClick={() => remove(person.id)}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                aria-label="Remove person"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {listError && (
        <p className={`${errorClass} mt-2`}>{listError}</p>
      )}
    </div>
  );
}

// Exposed so callers seeding an initial row use the same id scheme.
export { makeId as makePersonId };
