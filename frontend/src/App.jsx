import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import TestConsolePage from "./pages/TestConsolePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DebugToolbar from "./components/debug/DebugToolbar";
import PostPage from "./pages/PostPage";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { useClerkInterceptor } from "./lib/api";
import ProfilePage from "./pages/ProfilePage";

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
            // <ProtectedRoute>
            <ProfilePage />
            // </ProtectedRoute> TODO
          }
        />
        <Route path="/tests" element={<TestConsolePage />} />
        <Route path="/post/:slug" element={<PostPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      <DebugToolbar />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <InnerApp />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
