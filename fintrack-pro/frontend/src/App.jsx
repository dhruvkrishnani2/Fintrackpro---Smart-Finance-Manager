import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Transactions from "./pages/Transactions.jsx";
import Budgets from "./pages/Budgets.jsx";
import Goals from "./pages/Goals.jsx";
import Recurring from "./pages/Recurring.jsx";
import Imports from "./pages/Imports.jsx";
import Settings from "./pages/Settings.jsx";
import Family from "./pages/Family.jsx";
import Chatbot from "./pages/Chatbot.jsx";

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-paper">
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/analytics"
          element={
            <Protected>
              <Analytics />
            </Protected>
          }
        />
        <Route
          path="/transactions"
          element={
            <Protected>
              <Transactions />
            </Protected>
          }
        />
        <Route
          path="/budgets"
          element={
            <Protected>
              <Budgets />
            </Protected>
          }
        />
        <Route
          path="/goals"
          element={
            <Protected>
              <Goals />
            </Protected>
          }
        />
        <Route
          path="/recurring"
          element={
            <Protected>
              <Recurring />
            </Protected>
          }
        />
        <Route
          path="/imports"
          element={
            <Protected>
              <Imports />
            </Protected>
          }
        />
        <Route
          path="/family"
          element={
            <Protected>
              <Family />
            </Protected>
          }
        />
        <Route
          path="/assistant"
          element={
            <Protected>
              <Chatbot />
            </Protected>
          }
        />
        <Route
          path="/settings"
          element={
            <Protected>
              <Settings />
            </Protected>
          }
        />
      </Routes>
    </div>
  );
}
