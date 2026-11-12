import { useState } from "react";
import {
  LayoutDashboard,
  Monitor,
  Image,
  ListVideo,
  Settings,
  Menu,
  Sun,
  LogOut,
  ChevronLeft,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Devices", icon: Monitor },
  { name: "Media Library", icon: Image },
  { name: "Playlists", icon: ListVideo },
  { name: "Media Controller", icon: Monitor },
  { name: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
  activePage,
  onNavigate,
  admin,
  onLogout,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#111113] text-zinc-100">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/[0.07] bg-[#1c1c20] transition-all duration-300 ${
          collapsed ? "w-[78px]" : "w-[250px]"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/[0.07] px-5">
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Signage<span className="text-purple-400">CMS</span>
              </h1>
              <p className="text-[11px] text-zinc-500">
                Digital Display Management
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <Menu size={19} /> : <ChevronLeft size={19} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-zinc-500">
              Main Menu
            </p>
          )}

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  title={collapsed ? item.name : ""}
                  onClick={() => onNavigate(item.name)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[#34303c] text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${
                      active ? "text-purple-400" : ""
                    }`}
                  />
                  {!collapsed && <span>{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/[0.07] p-4">
          {!collapsed ? (
            <>
              <p className="mb-2 text-xs text-zinc-500">Current Role</p>
              <span className="rounded-md bg-[#34303c] px-3 py-1 text-xs font-medium text-purple-300">
                Administrator
              </span>
            </>
          ) : (
            <div className="flex justify-center">
              <span
                title="Administrator"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34303c] text-xs font-bold text-purple-300"
              >
                A
              </span>
            </div>
          )}
        </div>
      </aside>

      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "ml-[78px]" : "ml-[250px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#17171a]/95 px-6 backdrop-blur">
          <div className="text-sm text-zinc-400">
            Digital Signage Control Panel
          </div>

          <div className="flex items-center gap-5">
            <span className="hidden text-sm text-zinc-400 sm:block">
              {admin?.email || "Administrator"}
            </span>

            <button
              type="button"
              title="Theme"
              className="text-zinc-400 transition hover:text-white"
            >
              <Sun size={19} />
            </button>

            <button
              type="button"
              title="Logout"
              onClick={onLogout}
              className="text-zinc-400 transition hover:text-red-400"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}