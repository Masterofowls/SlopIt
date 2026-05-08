import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import TestConsolePage from "./pages/TestConsolePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DebugToolbar from "./components/debug/DebugToolbar";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/login/*" element={<AuthPage />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/tests" element={<TestConsolePage />} />
      </Routes>
      <DebugToolbar />
    </BrowserRouter>
  );
}

export default App;
