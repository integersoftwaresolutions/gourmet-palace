import { JobLogs } from './pages/admin/JobLogs'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/auth/AdminRoute'
import { GuestRoute } from './components/auth/GuestRoute'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { OnboardingRoute } from './components/auth/OnboardingRoute'
import { AuthProvider } from './context/AuthProvider'
import { AppStateProvider } from './context/AppStateProvider'
import { MorningBrief } from './pages/MorningBrief'
import { ReportingCenter } from './pages/ReportingCenter'
import { AdminPage } from './pages/admin/AdminPage'
import { AdministrationIntegration } from './pages/admin/AdministrationIntegration'
import { AdministrationSystemAndThresholds } from './pages/admin/AdministrationSystemAndThresholds'
import { Locations } from './pages/admin/Locations'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { OnboardingPage } from './pages/auth/OnboardingPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { SignInPage } from './pages/auth/SignInPage'
import { AlertsInbox } from './pages/AlertsInbox'
import { HomePage } from './pages/HomePage'
import { OnlinePresenceReviews } from './pages/OnlinePresenceReviews'
import { OnlinePresenceSeoGrowth } from './pages/OnlinePresenceSeoGrowth'
import { OperationsFoodCost } from './pages/OperationsFoodCost'
import { OperationsIngredientInventory } from './pages/OperationsIngredientInventory'
import { OperationsInvoices } from './pages/OperationsInvoices'
import { OperationsVendors } from './pages/OperationsVendors'
import { OperationsVendorDetail } from './pages/OperationsVendorDetail'
import { OverviewPage } from './pages/OverviewPage'
import { PerformanceFinance } from './pages/PerformanceFinance'
import { PerformanceForecast } from './pages/PerformanceForecast'
import { PerformanceOperations } from './pages/PerformanceOperations'
import { PerformanceStore } from './pages/PerformanceStore'
import { ComponentDemo } from './pages/ComponentDemo'

function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/signin"
            element={
              <GuestRoute>
                <SignInPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route
            path="/verify-email"
            element={
              <GuestRoute>
                <VerifyEmailPage />
              </GuestRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <GuestRoute>
                <ResetPasswordPage />
              </GuestRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <OnboardingRoute>
                <OnboardingPage />
              </OnboardingRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/overview"
            element={
              <ProtectedRoute>
                <OverviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <PerformanceStore />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance/operations"
            element={
              <ProtectedRoute>
                <PerformanceOperations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance/finance"
            element={
              <AdminRoute>
                <PerformanceFinance />
              </AdminRoute>
            }
          />
          <Route
            path="/performance/forecast"
            element={
              <ProtectedRoute>
                <PerformanceForecast />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations"
            element={
              <ProtectedRoute>
                <OperationsInvoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/invoice-ocr"
            element={<Navigate to="/operations" replace />}
          />
          <Route
            path="/operations/inventory"
            element={
              <ProtectedRoute>
                <OperationsIngredientInventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/vendors"
            element={
              <ProtectedRoute>
                <OperationsVendors />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/vendors/:id"
            element={
              <ProtectedRoute>
                <OperationsVendorDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operations/food-cost"
            element={
              <AdminRoute>
                <OperationsFoodCost />
              </AdminRoute>
            }
          />
          <Route
            path="/presence"
            element={
              <AdminRoute>
                <OnlinePresenceReviews />
              </AdminRoute>
            }
          />
          <Route
            path="/presence/seo"
            element={
              <AdminRoute>
                <OnlinePresenceSeoGrowth />
              </AdminRoute>
            }
          />
          <Route
            path="/morning-brief"
            element={
              <ProtectedRoute>
                <MorningBrief />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <AdminRoute>
                <ReportingCenter />
              </AdminRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/locations"
            element={
              <AdminRoute>
                <Locations />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/integrations"
            element={
              <AdminRoute>
                <AdministrationIntegration />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/system"
            element={
              <AdminRoute>
                <AdministrationSystemAndThresholds />
              </AdminRoute>
            }
          />
          <Route path="/admin/jobs" element={<AdminRoute><JobLogs /></AdminRoute>} />
          <Route path="/demo" element={<ComponentDemo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AppStateProvider>
    </AuthProvider>
  )
}

export default App
