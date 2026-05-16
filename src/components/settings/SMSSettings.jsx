import { useState } from 'react';
import { useData } from '../../context/DataContext';
import Card from '../common/Card';

export default function SMSSettings() {
  const { settings, updateSettings } = useData();
  const autoParseValue = (settings?.sms_auto_parse ?? 'false').toString().toLowerCase();
  const isEnabled = autoParseValue === 'true';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function toggleAutoParse() {
    setSaving(true);
    setError(null);
    try {
      await updateSettings('sms_auto_parse', isEnabled ? 'false' : 'true');
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

          <button
            type="button"
            onClick={toggleAutoParse}
            disabled={saving}
            role="switch"
            aria-checked={isEnabled}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              isEnabled ? 'bg-brand' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-500">{error}</p>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
          Status: <span className={`font-semibold ${isEnabled ? 'text-brand' : 'text-gray-500'}`}>
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
          {isEnabled && (
            <span className="ml-2">— make sure <code className="px-1 rounded bg-gray-100">LLM_ENABLED=true</code> and <code className="px-1 rounded bg-gray-100">GROQ_API_KEY</code> are set in <code className="px-1 rounded bg-gray-100">.env</code>.</span>
          )}
        </div>
      </Card>
    </div>
  );
}
