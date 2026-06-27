import { useState } from 'react';
import { useData } from '../../context/DataContext';
import Card from '../common/Card';

function Toggle({ checked, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SMSSettings() {
  const { settings, updateSettings } = useData();
  const autoParseEnabled = (settings?.sms_auto_parse ?? 'false').toString().toLowerCase() === 'true';
  const autoConfirmEnabled = (settings?.sms_auto_confirm ?? 'false').toString().toLowerCase() === 'true';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function toggle(key, currentValue) {
    setSaving(true);
    setError(null);
    try {
      await updateSettings(key, currentValue ? 'false' : 'true');
    } catch (err) {
      setError(err.message || 'Failed to save setting.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100 mb-4">
          <h3 className="text-base font-bold text-gray-800">SMS Parsing</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Control how incoming SMS messages get processed.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-700">Auto-parse incoming SMS</p>
            <p className="text-xs text-gray-400 mt-0.5">
              When enabled, every SMS your phone forwards is immediately sent to
              the LLM for parsing. When disabled (default), incoming SMS lands as
              <code className="text-[11px] mx-1 px-1 rounded bg-gray-100">pending</code>
              and you trigger parsing manually from the SMS page.
            </p>
          </div>
          <Toggle checked={autoParseEnabled} onClick={() => toggle('sms_auto_parse', autoParseEnabled)} disabled={saving} />
        </div>

        <div className="flex items-start justify-between gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-700">Auto-confirm parsed SMS</p>
            <p className="text-xs text-gray-400 mt-0.5">
              When enabled, parsed SMS that are high-confidence and have all
              required fields populated (amount, date, accounts, category)
              auto-create the transaction. Anything incomplete or low-confidence
              still lands as <code className="text-[11px] mx-1 px-1 rounded bg-gray-100">parsed</code> for manual confirm.
              Requires Auto-parse to be on.
            </p>
          </div>
          <Toggle checked={autoConfirmEnabled} onClick={() => toggle('sms_auto_confirm', autoConfirmEnabled)} disabled={saving} />
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-500">{error}</p>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
          Auto-parse:{' '}
          <span className={`font-semibold ${autoParseEnabled ? 'text-brand' : 'text-gray-500'}`}>
            {autoParseEnabled ? 'On' : 'Off'}
          </span>
          {' · '}Auto-confirm:{' '}
          <span className={`font-semibold ${autoConfirmEnabled ? 'text-brand' : 'text-gray-500'}`}>
            {autoConfirmEnabled ? 'On' : 'Off'}
          </span>
        </div>
      </Card>
    </div>
  );
}
