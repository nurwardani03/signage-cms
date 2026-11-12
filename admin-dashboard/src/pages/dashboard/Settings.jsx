
import { useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  ShieldCheck,
  Monitor,
  Save,
  Lock,
  Mail,
  Globe,
  CheckCircle2,
  Info,
} from "lucide-react";

const defaultSettings = {
  appName: "SignageCMS",
  description: "Digital Display Management System",
  timezone: "Asia/Jakarta",
};

export default function Settings({ admin }) {
  const [activeTab, setActiveTab] = useState("General");

  const [general, setGeneral] = useState(() => {
    try {
      const saved = localStorage.getItem("signage_settings");
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [profile, setProfile] = useState({
    name: admin?.name || admin?.nama || "Administrator",
    email: admin?.email || "",
  });

  const [password, setPassword] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });

  const [notification, setNotification] = useState("");

  const tabs = [
    { name: "General", icon: SettingsIcon },
    { name: "Profile", icon: User },
    { name: "Security", icon: ShieldCheck },
    { name: "System", icon: Monitor },
  ];

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  const handleGeneralSave = (event) => {
    event.preventDefault();

    localStorage.setItem("signage_settings", JSON.stringify(general));
    showNotification("General settings berhasil disimpan.");
  };

  const handleProfileSave = (event) => {
    event.preventDefault();

    // Simpan preferensi profil secara lokal.
    localStorage.setItem("signage_profile", JSON.stringify(profile));
    showNotification("Preferensi profil berhasil disimpan.");
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();

    if (!password.current || !password.newPassword || !password.confirm) {
      showNotification("Lengkapi semua field password.");
      return;
    }

    if (password.newPassword.length < 8) {
      showNotification("Password baru minimal 8 karakter.");
      return;
    }

    if (password.newPassword !== password.confirm) {
      showNotification("Konfirmasi password tidak sesuai.");
      return;
    }

    showNotification(
      "Form valid. Hubungkan endpoint backend untuk mengubah password."
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <SettingsIcon size={22} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage your application preferences and account settings.
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-300">
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_1fr]">
        {/* Settings Sidebar */}
        <div className="h-fit rounded-xl border border-white/[0.07] bg-[#19191d] p-3">
          <p className="mb-3 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-zinc-500">
            Preferences
          </p>

          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.name;

              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[#34303c] text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    size={18}
                    className={active ? "text-purple-400" : ""}
                  />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="min-w-0 rounded-xl border border-white/[0.07] bg-[#19191d]">
          {/* GENERAL */}
          {activeTab === "General" && (
            <form onSubmit={handleGeneralSave}>
              <div className="border-b border-white/[0.07] p-6">
                <h2 className="text-lg font-semibold text-white">
                  General Settings
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configure your application information and preferences.
                </p>
              </div>

              <div className="space-y-6 p-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={general.appName}
                    onChange={(e) =>
                      setGeneral({ ...general, appName: e.target.value })
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                    placeholder="Application name"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Application Description
                  </label>
                  <textarea
                    rows={3}
                    value={general.description}
                    onChange={(e) =>
                      setGeneral({
                        ...general,
                        description: e.target.value,
                      })
                    }
                    className="w-full resize-none rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                    placeholder="Application description"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Timezone
                  </label>
                  <div className="relative">
                    <Globe
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                    <select
                      value={general.timezone}
                      onChange={(e) =>
                        setGeneral({
                          ...general,
                          timezone: e.target.value,
                        })
                      }
                      className="w-full appearance-none rounded-lg border border-white/10 bg-[#111113] py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-purple-500"
                    >
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-white/[0.07] p-6">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                >
                  <Save size={17} />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* PROFILE */}
          {activeTab === "Profile" && (
            <form onSubmit={handleProfileSave}>
              <div className="border-b border-white/[0.07] p-6">
                <h2 className="text-lg font-semibold text-white">
                  Profile Settings
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  View and manage your administrator profile.
                </p>
              </div>

              <div className="space-y-6 p-6">
                <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-[#111113] p-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/15 text-xl font-bold text-purple-400">
                    {(profile.name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {profile.name}
                    </h3>
                    <p className="text-sm text-zinc-500">Administrator</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#111113] py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                    <input
                      type="email"
                      value={profile.email}
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-[#111113] py-3 pl-11 pr-4 text-sm text-zinc-500 outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Email mengikuti akun administrator yang sedang login.
                  </p>
                </div>
              </div>

              <div className="flex justify-end border-t border-white/[0.07] p-6">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                >
                  <Save size={17} />
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* SECURITY */}
          {activeTab === "Security" && (
            <form onSubmit={handlePasswordSubmit}>
              <div className="border-b border-white/[0.07] p-6">
                <h2 className="text-lg font-semibold text-white">
                  Security Settings
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Manage your account security.
                </p>
              </div>

              <div className="space-y-6 p-6">
                <div className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                  <Info size={19} className="shrink-0 text-blue-400" />
                  <p className="text-xs leading-5 text-blue-300">
                    Password change requires a backend authentication endpoint.
                    This form currently performs input validation only.
                  </p>
                </div>

                {[
                  {
                    key: "current",
                    label: "Current Password",
                    placeholder: "Enter current password",
                  },
                  {
                    key: "newPassword",
                    label: "New Password",
                    placeholder: "Enter new password",
                  },
                  {
                    key: "confirm",
                    label: "Confirm New Password",
                    placeholder: "Confirm new password",
                  },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      {field.label}
                    </label>
                    <div className="relative">
                      <Lock
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                      />
                      <input
                        type="password"
                        value={password[field.key]}
                        onChange={(e) =>
                          setPassword({
                            ...password,
                            [field.key]: e.target.value,
                          })
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-white/10 bg-[#111113] py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-white/[0.07] p-6">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                >
                  <ShieldCheck size={17} />
                  Update Password
                </button>
              </div>
            </form>
          )}

          {/* SYSTEM */}
          {activeTab === "System" && (
            <>
              <div className="border-b border-white/[0.07] p-6">
                <h2 className="text-lg font-semibold text-white">
                  System Information
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Application and system information.
                </p>
              </div>

              <div className="space-y-3 p-6">
                {[
                  ["Application", "SignageCMS"],
                  ["Version", "1.0.0"],
                  ["Platform", "Web Application"],
                  ["Frontend", "React + Vite"],
                  ["Backend", "Node.js + Express"],
                  ["Database", "Supabase"],
                  ["Storage", "Supabase Storage"],
                  ["Role", "Administrator"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-white/[0.07] bg-[#111113] px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <span className="text-sm text-zinc-400">{label}</span>
                    <span className="text-sm font-medium text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mx-6 mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <CheckCircle2 size={19} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">
                    System Information
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    SignageCMS application information.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
