import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'
import AppLayout from './components/layout/AppLayout'
import LoadingSpinner from './components/common/LoadingSpinner'
import ErrorBoundary from './components/common/ErrorBoundary'

// Each route is its own chunk. The initial bundle drops to just the shell
// (App, AuthContext, DataContext, AppLayout, common primitives); pages and
// their dependencies load on navigation. Recharts in particular only loads
// when the user opens /reports — Vite's manualChunks config splits it
// further into its own vendor bundle.
const LoginPage       = lazy(() => import('./pages/LoginPage'))
const RegisterPage    = lazy(() => import('./pages/RegisterPage'))
const DashboardPage   = lazy(() => import('./pages/DashboardPage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const AccountsPage    = lazy(() => import('./pages/AccountsPage'))
const ReportsPage     = lazy(() => import('./pages/ReportsPage'))
const SettingsPage    = lazy(() => import('./pages/SettingsPage'))
const SMSPage         = lazy(() => import('./pages/SMSPage'))
const SMSReviewPage   = lazy(() => import('./pages/SMSReviewPage'))
const TransactionForm = lazy(() => import('./components/transactions/TransactionForm'))

// Small fallback for route transitions. DataGate still handles the initial
// app-wide load with its branded screen; this just covers the brief moment
// while a route chunk is being fetched.
function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <LoadingSpinner size="h-8 w-8" />
    </div>
  )
}

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
    <ToastProvider>
      <ErrorBoundary>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/*"
                element={
                  <AuthGate>
                    <DataProvider>
                      <DataGate>
                        <Suspense fallback={<RouteFallback />}>
                          <Routes>
                            <Route element={<AppLayout />}>
                              <Route path="/" element={<DashboardPage />} />
                              <Route path="/transactions" element={<TransactionsPage />} />
                              <Route path="/transactions/new" element={<TransactionForm />} />
                              <Route path="/transactions/:id/edit" element={<TransactionForm />} />
                              <Route path="/accounts" element={<AccountsPage />} />
                              <Route path="/reports" element={<ReportsPage />} />
                              <Route path="/sms" element={<SMSPage />} />
                              <Route path="/sms/review" element={<SMSReviewPage />} />
                              <Route path="/settings" element={<SettingsPage />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </Suspense>
                      </DataGate>
                    </DataProvider>
                  </AuthGate>
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ErrorBoundary>
    </ToastProvider>
  )
}
