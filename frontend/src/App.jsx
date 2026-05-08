import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import LandingPage from "./pages/LandingPage";
import TestConsolePage from "./pages/TestConsolePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DebugToolbar from "./components/debug/DebugToolbar";
import { AuthProvider } from "./context/AuthContext";
import { useClerkInterceptor } from "./lib/api";

function InnerApp() {
  useClerkInterceptor();

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
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
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
