import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import ProtectedRoute from
  "./components/ProtectedRoute";

import AppLayout from
  "./layouts/AppLayout";

import DashboardPage from
  "./pages/DashboardPage";

import LoginPage from
  "./pages/LoginPage";

import ModulePlaceholderPage from
  "./pages/ModulePlaceholderPage";

import SalesPage from
  "./pages/SalesPage";

import SalesHistoryPage from
  "./pages/SalesHistoryPage";

import PurchasePage from
  "./pages/PurchasePage";

import ReportsPage from
  "./pages/ReportsPage";

import StockPage from
  "./pages/StockPage";

import StockAdjustmentPage from
  "./pages/StockAdjustmentPage";

import MedicinesPage from
  "./pages/MedicinesPage";

import SettingsPage from
  "./pages/SettingsPage";

import "./App.css";

function App() {
  return (
    <Routes>
      {/* Public route */}

      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      {/* Protected routes */}

      <Route
        element={
          <ProtectedRoute />
        }
      >
        <Route
          element={
            <AppLayout />
          }
        >
          <Route
            path="/dashboard"
            element={
              <DashboardPage />
            }
          />

          <Route
            path="/sales"
            element={
              <SalesPage />
            }
          />

          <Route
            path="/sales/history"
            element={
              <SalesHistoryPage />
            }
          />

          <Route
            path="/purchases"
            element={
              <PurchasePage />
            }
          />

          <Route
            path="/medicines"
            element={
              <MedicinesPage />
            }
          />

          <Route
            path="/stock"
            element={
              <StockPage />
            }
          />

          <Route
            path="/stock/adjustments"
            element={
              <StockAdjustmentPage />
            }
          />

          <Route
            path="/reports"
            element={
              <ReportsPage />
            }
          />

          <Route
            path="/settings"
            element={
              <SettingsPage />
            }
          />
          
        </Route>
      </Route>

      {/* Default route */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      {/* Unknown route */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;