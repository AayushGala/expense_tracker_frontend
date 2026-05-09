import { useEffect, useState } from 'react';
import Card from '../common/Card';
import { useData } from '../../context/DataContext';
import api from '../../api/client';
import {
  transactionsToCSV,
  downloadBlob,
  csvTimestamp,
} from '../../utils/transactionCsv';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DataExport() {
  const {
    accounts,
    categories,
    transactions,
    entries,
    receivables,
    budgets,
    settings,
  } = useData();

  // --- Backup state ---
  const [backups, setBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);
  const [backupError, setBackupError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.listBackups()
      .then((list) => { if (!cancelled) setBackups(list); })
      .catch(() => { /* silent on initial load — surface only on user action */ });
    return () => { cancelled = true; };
  }, []);

  // Auto-clear success message after 3s
  useEffect(() => {
    if (!backupMessage) return;
    const id = setTimeout(() => setBackupMessage(null), 3000);
    return () => clearTimeout(id);
  }, [backupMessage]);

  async function refreshBackups() {
    try {
      const list = await api.listBackups();
      setBackups(list);
    } catch (err) {
      setBackupError(err.message);
    }
  }

  async function handleCreateBackup() {
    setBackupBusy(true);
    setBackupMessage(null);
    setBackupError(null);
    try {
      const result = await api.createBackup();
      setBackupMessage(`Created ${result.filename} (${formatSize(result.size_bytes)})`);
      await refreshBackups();
    } catch (err) {
      setBackupError(err.message);
    } finally {
      setBackupBusy(false);
    }
  }

  function handleExportJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      accounts,
      categories,
      transactions,
      entries,
      receivables,
      budgets,
      settings,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `expense-tracker-export-${csvTimestamp()}.json`);
  }

  function handleExportCSV() {
    const csv = transactionsToCSV(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `transactions-${csvTimestamp()}.csv`);
  }

  const btnClass =
    'shrink-0 text-sm px-5 py-2.5 min-w-[160px] justify-center bg-brand text-white rounded-xl font-bold hover:bg-brand-hover flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Database Backups</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Snapshot the SQLite database into a timestamped file. Backups are stored on the server in <code className="text-[10px]">backups/</code>.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-gray-700">Create a backup now</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Uses SQLite's online backup API — safe even if the app is in use.
              </p>
            </div>
            <button onClick={handleCreateBackup} disabled={backupBusy} className={btnClass}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {backupBusy ? 'Creating…' : 'Create Backup'}
            </button>
          </div>

          {backupMessage && (
            <p className="text-xs text-accent">{backupMessage}</p>
          )}
          {backupError && (
            <p className="text-xs text-red-500">{backupError}</p>
          )}

          {backups.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                  Existing backups ({backups.length})
                </p>
              </div>
              <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {backups.map((b) => (
                  <li key={b.filename} className="px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-700 truncate">{b.filename}</p>
                      <p className="text-[11px] text-gray-400">{new Date(b.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">
                      {formatSize(b.size_bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Data Export</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Download a copy of your data. The file is generated entirely in your browser.
          </p>
        </div>

        <div className="mt-4 space-y-5">
          {/* JSON */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-gray-700">Full Export (JSON)</p>
              <p className="text-xs text-gray-400 mt-0.5">
                All data: accounts, categories, transactions, entries, receivables, budgets and settings.
              </p>
            </div>
            <button onClick={handleExportJSON} className={btnClass}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
              </svg>
              Export JSON
            </button>
          </div>

          <div className="h-px bg-gray-50" />

          {/* CSV */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-gray-700">Transactions (CSV)</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Transactions only — compatible with spreadsheet apps.
                {transactions.length > 0 && (
                  <> Includes {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}.</>
                )}
              </p>
            </div>
            <button onClick={handleExportCSV} className={btnClass}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
