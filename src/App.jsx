import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import AccountsPage from './pages/AccountsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import SMSPage from './pages/SMSPage'
import TransactionForm from './components/transactions/TransactionForm'
import LoadingSpinner from './components/common/LoadingSpinner'
import ErrorBoundary from './components/common/ErrorBoundary'

function AuthGate({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="h-10 w-10" />
          <p className="mt-4 text-sm text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function DataGate({ children }) {
  const { isLoading } = useData()

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 tracking-tight">Expense Tracker</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Personal Finance</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full animate-[loading_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <AuthGate>
              <DataProvider>
                <DataGate>
                  <ErrorBoundary>
                    <Routes>
                      <Route element={<AppLayout />}>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/transactions" element={<TransactionsPage />} />
                        <Route path="/transactions/new" element={<TransactionForm />} />
                        <Route path="/transactions/:id/edit" element={<TransactionForm />} />
                        <Route path="/accounts" element={<AccountsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/sms" element={<SMSPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </ErrorBoundary>
                </DataGate>
              </DataProvider>
            </AuthGate>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
