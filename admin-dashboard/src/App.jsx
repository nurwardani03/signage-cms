
import { useState } from "react";

import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/auth/Login";

import Overview from "./pages/dashboard/Overview";
import Devices from "./pages/dashboard/Devices";
import MediaLibrary from "./pages/dashboard/MediaLibrary";
import MediaController from "./pages/dashboard/MediaController";
import Playlists from "./pages/dashboard/Playlists";
import Settings from "./pages/dashboard/Settings";

// Get saved admin session
const getSavedSession = () => {
  const token =
    localStorage.getItem("signage_token") ||
    sessionStorage.getItem("signage_token");

  const adminData =
    localStorage.getItem("signage_admin") ||
    sessionStorage.getItem("signage_admin");

  if (!token || !adminData) return null;

  try {
    return {
      token,
      admin: JSON.parse(adminData),
    };
  } catch (error) {
    console.error("Failed to restore session:", error);
    return null;
  }
};

function App() {
  const [session, setSession] = useState(getSavedSession);
  const [activePage, setActivePage] = useState("Dashboard");

  // Handle admin login
  const handleLogin = ({ token, admin, remember }) => {
    localStorage.removeItem("signage_token");
    localStorage.removeItem("signage_admin");

    sessionStorage.removeItem("signage_token");
    sessionStorage.removeItem("signage_admin");

    const storage = remember ? localStorage : sessionStorage;

    storage.setItem("signage_token", token);
    storage.setItem("signage_admin", JSON.stringify(admin));

    setSession({ token, admin });
    setActivePage("Dashboard");
  };

  // Handle admin logout
  const handleLogout = () => {
    localStorage.removeItem("signage_token");
    localStorage.removeItem("signage_admin");

    sessionStorage.removeItem("signage_token");
    sessionStorage.removeItem("signage_admin");

    setSession(null);
    setActivePage("Dashboard");
  };

  // Show login page if session does not exist
  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  // Render dashboard pages
  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return <Overview />;

      case "Devices":
        return <Devices />;

      case "Media Library":
        return <MediaLibrary />;

      case "Media Controller":
        return <MediaController />;

      case "Playlists":
        return <Playlists />;

      case "Settings":
        return <Settings admin={session.admin} />;

      default:
        return (
          <div className="rounded-xl border border-white/10 bg-[#19191d] p-8">
            <h1 className="text-xl font-bold text-white">
              {activePage}
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              This module will be implemented soon.
            </p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
      admin={session.admin}
      onLogout={handleLogout}
    >
      {renderPage()}
    </DashboardLayout>
  );
}

export default App;
