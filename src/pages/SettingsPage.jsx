import { useState } from 'react';
import CategoryManager from '../components/settings/CategoryManager';
import AccountManager from '../components/settings/AccountManager';
import TagManager from '../components/settings/TagManager';
import OwnerSettings from '../components/settings/OwnerSettings';
import AccountTypeManager from '../components/settings/AccountTypeManager';
import SMSSettings from '../components/settings/SMSSettings';
import DataExport from '../components/settings/DataExport';
import BookCloseManager from '../components/settings/BookCloseManager';

const SECTIONS = [
  { id: 'categories',   label: 'Categories',   icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { id: 'account-types', label: 'Account Types', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'accounts',     label: 'Accounts',     icon: 'M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7z M16 14a2 2 0 100-4 2 2 0 000 4z' },
  { id: 'owners',       label: 'Owners',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'tags',         label: 'Tags',         icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z' },
  { id: 'sms',          label: 'SMS',          icon: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
  { id: 'book-close',   label: 'Book Closing', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
  { id: 'export',       label: 'Data Export',   icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('categories');

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your tracker configuration.</p>
      </div>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="md:hidden flex overflow-x-auto scrollbar-none gap-1 border-b border-gray-200 -mx-4 px-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeSection === s.id
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3.5 w-3.5 flex-shrink-0 ${activeSection === s.id ? 'text-accent' : 'text-gray-400'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={s.icon} />
            </svg>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Desktop: sidebar nav */}
        <nav className="hidden md:block md:w-52 flex-shrink-0">
          <div className="md:sticky md:top-8">
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
                      activeSection === s.id
                        ? 'bg-brand text-white'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 flex-shrink-0 ${activeSection === s.id ? 'text-accent' : 'text-gray-400'}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={s.icon} />
                    </svg>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'categories'  && <CategoryManager />}
          {activeSection === 'accounts'    && <AccountManager />}
          {activeSection === 'account-types' && <AccountTypeManager />}
          {activeSection === 'owners'      && <OwnerSettings />}
          {activeSection === 'tags'        && <TagManager />}
          {activeSection === 'sms'         && <SMSSettings />}
          {activeSection === 'book-close'  && <BookCloseManager />}
          {activeSection === 'export'      && <DataExport />}
        </div>
      </div>
    </div>
  );
}
