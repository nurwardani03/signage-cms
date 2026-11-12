
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Monitor,
  Wifi,
  WifiOff,
  Search,
  Plus,
  MapPin,
  Clock,
  Eye,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Info,
} from "lucide-react";

import {
  apiFetch,
  createAdminSocket,
  API_URL,
} from "../../lib/api";

const emptyForm = {
  nama: "",
  lokasi: "",
};

// =====================================
// HELPERS
// =====================================

function formatLastSeen(value) {
  if (!value) return "Never connected";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const diff = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDeviceCode(index) {
  return `DEV-${String(index + 1).padStart(3, "0")}`;
}

function StatusBadge({ status }) {
  const isOnline = status === "online";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
        isOnline
          ? "bg-green-500/10 text-green-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOnline ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  color,
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-400">
          {label}
        </p>

        <div className={`rounded-lg bg-white/5 p-2 ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      <h2 className={`mt-3 text-3xl font-bold ${color}`}>
        {value}
      </h2>

      <p className="mt-2 text-xs text-zinc-500">
        {description}
      </p>
    </div>
  );
}

// =====================================
// TOAST NOTIFICATION
// =====================================

function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  const Icon = isSuccess
    ? CheckCircle2
    : isError
      ? AlertCircle
      : Info;

  const color = isSuccess
    ? "text-green-400"
    : isError
      ? "text-red-400"
      : "text-blue-400";

  const border = isSuccess
    ? "border-green-500/20"
    : isError
      ? "border-red-500/20"
      : "border-blue-500/20";

  return (
    <div className="fixed right-5 top-5 z-[100] w-[calc(100%-40px)] max-w-sm animate-in slide-in-from-right-5 fade-in duration-300">
      <div
        className={`flex items-start gap-3 rounded-xl border ${border} bg-[#202025] p-4 shadow-2xl`}
      >
        <Icon size={21} className={`mt-0.5 shrink-0 ${color}`} />

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${color}`}>
            {toast.title}
          </p>

          <p className="mt-1 break-words text-xs leading-relaxed text-zinc-400">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// =====================================
// DEVICE MANAGEMENT
// =====================================

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [reconnectingId, setReconnectingId] = useState(null);

  const [toast, setToast] = useState(null);

  const socketRef = useRef(null);
  const toastTimerRef = useRef(null);

  // =====================================
  // NOTIFICATION HANDLER
  // =====================================

  const showToast = useCallback((type, title, message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ type, title, message });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const closeToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast(null);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // =====================================
  // SORT DEVICES BY REGISTRATION DATE
  // =====================================

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }, [devices]);

  const getDisplayCode = (device) => {
    const index = sortedDevices.findIndex(
      (item) => item.id === device?.id
    );

    return index === -1 ? "-" : getDeviceCode(index);
  };

  // =====================================
  // FETCH DEVICES
  // =====================================

  const fetchDevices = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const response = await apiFetch(`${API_URL}/api/devices`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to retrieve devices."
        );
      }

      setDevices(result.data || []);
    } catch (error) {
      showToast(
        "error",
        "Failed to Load Devices",
        error.message || "Cannot connect to server."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [showToast]);

  // =====================================
  // SOCKET.IO
  // =====================================

  useEffect(() => {
    fetchDevices();

    const socket = createAdminSocket({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("devices:status", (updatedDevice) => {
      if (!updatedDevice?.id) return;

      setDevices((current) =>
        current.map((device) =>
          device.id === updatedDevice.id
            ? { ...device, ...updatedDevice }
            : device
        )
      );

      setSelectedDevice((current) =>
        current?.id === updatedDevice.id
          ? { ...current, ...updatedDevice }
          : current
      );
    });

    socket.on("connect_error", (error) => {
      console.error("Admin socket error:", error.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchDevices]);

  // =====================================
  // DEVICE STATISTICS
  // =====================================

  const onlineCount = devices.filter(
    (device) => device.status === "online"
  ).length;

  const offlineCount = devices.length - onlineCount;

  // =====================================
  // SEARCH AND FILTER
  // =====================================

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return sortedDevices.filter((device, index) => {
      const nama = (device.nama || "").toLowerCase();
      const lokasi = (device.lokasi || "").toLowerCase();
      const id = (device.id || "").toLowerCase();

      const displayCode = getDeviceCode(index).toLowerCase();

      const matchesSearch =
        nama.includes(keyword) ||
        lokasi.includes(keyword) ||
        id.includes(keyword) ||
        displayCode.includes(keyword);

      const matchesFilter =
        filter === "all" || device.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [sortedDevices, search, filter]);

  // =====================================
  // OPEN ADD MODAL
  // =====================================

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  // =====================================
  // OPEN EDIT MODAL
  // =====================================

  const openEditModal = (device) => {
    setEditingId(device.id);

    setForm({
      nama: device.nama || "",
      lokasi: device.lokasi || "",
    });

    setShowModal(true);
  };

  // =====================================
  // CLOSE FORM MODAL
  // =====================================

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  // =====================================
  // ADD / UPDATE DEVICE
  // =====================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nama = form.nama.trim();
    const lokasi = form.lokasi.trim();

    if (!nama || !lokasi) {
      showToast(
        "error",
        "Validation Error",
        "Device name and location are required."
      );
      return;
    }

    setSaving(true);

    try {
      const isEditing = Boolean(editingId);

      const url = isEditing
        ? `${API_URL}/api/devices/${editingId}`
        : `${API_URL}/api/devices`;

      const response = await apiFetch(url, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({ nama, lokasi }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Failed to update device."
              : "Failed to add device.")
        );
      }

      if (isEditing) {
        setDevices((current) =>
          current.map((device) =>
            device.id === editingId
              ? { ...device, ...result.data }
              : device
          )
        );

        setSelectedDevice((current) =>
          current?.id === editingId
            ? { ...current, ...result.data }
            : current
        );

        showToast(
          "success",
          "Device Updated",
          `${nama} has been updated successfully.`
        );
      } else {
        setDevices((current) => [
          ...current,
          result.data,
        ]);

        showToast(
          "success",
          "Device Added",
          `${nama} has been registered successfully.`
        );
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      showToast(
        "error",
        editingId ? "Update Failed" : "Registration Failed",
        error.message
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // DELETE DEVICE
  // =====================================

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const device = deleteTarget;

    setDeletingId(device.id);

    try {
      const response = await apiFetch(
        `${API_URL}/api/devices/${device.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to delete device."
        );
      }

      setDevices((current) =>
        current.filter((item) => item.id !== device.id)
      );

      setSelectedDevice((current) =>
        current?.id === device.id ? null : current
      );

      setDeleteTarget(null);

      showToast(
        "success",
        "Device Deleted",
        `${device.nama} has been deleted successfully.`
      );
    } catch (error) {
      showToast(
        "error",
        "Delete Failed",
        error.message
      );
    } finally {
      setDeletingId(null);
    }
  };

  // =====================================
  // REMOTE RECONNECT
  // =====================================

  const handleReconnect = (device) => {
    if (device.status !== "online") {
      showToast(
        "error",
        "Device Offline",
        "The device is offline. Automatic reconnection will be attempted by the Device Client."
      );
      return;
    }

    const socket = socketRef.current;

    if (!socket?.connected) {
      showToast(
        "error",
        "Connection Error",
        "Admin connection to the server is disconnected."
      );
      return;
    }

    setReconnectingId(device.id);

    socket.emit(
      "admin:reconnect",
      { deviceId: device.id },
      (result) => {
        setReconnectingId(null);

        if (!result?.success) {
          showToast(
            "error",
            "Reconnect Failed",
            result?.message || "Failed to send reconnect command."
          );
          return;
        }

        showToast(
          "success",
          "Reconnect Command Sent",
          result.message || "Reconnect command sent successfully."
        );
      }
    );
  };

  // =====================================
  // RENDER
  // =====================================

  return (
    <div className="space-y-7">

      <Toast toast={toast} onClose={closeToast} />

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">
              Device Management
            </h1>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[10px] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Monitoring Active
            </span>
          </div>

          <p className="mt-1 text-sm text-zinc-400">
            Manage and monitor display devices across your company.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fetchDevices()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            <Plus size={18} />
            Add New Device
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="TOTAL DEVICES"
          value={devices.length}
          description="Registered display devices"
          icon={Monitor}
          color="text-blue-400"
        />

        <StatCard
          label="ONLINE DEVICES"
          value={onlineCount}
          description="Currently connected"
          icon={Wifi}
          color="text-green-400"
        />

        <StatCard
          label="OFFLINE DEVICES"
          value={offlineCount}
          description="Require attention"
          icon={WifiOff}
          color="text-red-400"
        />
      </div>

      {/* DEVICE TABLE */}

      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#19191d]">

        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-white">
              Registered Devices
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              View device details, connection status, and last activity.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#111113] px-3">
              <Search size={17} className="text-zinc-500" />

              <input
                type="text"
                placeholder="Search device..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 sm:w-48"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#111113] px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-purple-500"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-[#222228] text-xs text-zinc-400">
              <tr>
                <th className="px-5 py-4 font-medium">Device</th>
                <th className="px-5 py-4 font-medium">Location</th>
                <th className="px-5 py-4 font-medium">Device Type</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Last Seen</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-12 text-center text-sm text-zinc-400"
                  >
                    Loading devices...
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center">
                    <Monitor
                      size={30}
                      className="mx-auto mb-3 text-zinc-600"
                    />

                    <p className="text-sm text-zinc-400">
                      {devices.length === 0
                        ? "No devices registered yet."
                        : "No devices found."}
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Add a device to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr
                    key={device.id}
                    className="transition hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                          <Monitor size={19} />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {device.nama}
                          </p>

                          <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500">
                            {getDisplayCode(device)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <MapPin size={14} />
                        {device.lokasi}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs text-zinc-300">
                        Digital Signage
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={device.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Clock size={14} />
                        {formatLastSeen(device.last_seen)}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedDevice(device)}
                          title="View details"
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-purple-500/10 hover:text-purple-400"
                        >
                          <Eye size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(device)}
                          title="Edit device"
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-blue-500/10 hover:text-blue-400"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReconnect(device)}
                          disabled={
                            device.status !== "online" ||
                            reconnectingId === device.id
                          }
                          title="Remote reconnect"
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-purple-500/10 hover:text-purple-400 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <RefreshCw
                            size={17}
                            className={
                              reconnectingId === device.id
                                ? "animate-spin"
                                : ""
                            }
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(device)}
                          disabled={deletingId === device.id}
                          title="Delete device"
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-4">
          <p className="text-xs text-zinc-500">
            Showing {filteredDevices.length} of {devices.length} devices
          </p>

          <span className="text-xs text-zinc-500">
            {onlineCount} Online · {offlineCount} Offline
          </span>
        </div>
      </div>

      {/* ADD / EDIT DEVICE MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1c1c20] shadow-2xl">

            <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
              <div>
                <h2 className="font-semibold text-white">
                  {editingId ? "Edit Device" : "Add New Device"}
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  {editingId
                    ? "Update your display device information."
                    : "Register a new display device."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Device Name
                </label>

                <input
                  required
                  maxLength={150}
                  value={form.nama}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nama: event.target.value,
                    }))
                  }
                  placeholder="Example: Warehouse Display"
                  className="w-full rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Location
                </label>

                <input
                  required
                  maxLength={150}
                  value={form.lokasi}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lokasi: event.target.value,
                    }))
                  }
                  placeholder="Example: Warehouse"
                  className="w-full rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-[#111113] p-3">
                <p className="text-xs text-zinc-400">
                  Device Type
                </p>

                <p className="mt-1 text-sm text-zinc-200">
                  Digital Signage
                </p>

                <p className="mt-1 text-[11px] text-zinc-600">
                  Device type is currently a standard system label.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : editingId ? (
                    <Pencil size={16} />
                  ) : (
                    <Plus size={16} />
                  )}

                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Add Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c20] p-6 shadow-2xl">

            <div className="mb-5 flex items-start gap-3">
              <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
                <Trash2 size={23} />
              </div>

              <div className="flex-1">
                <h2 className="font-semibold text-white">
                  Delete Device?
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  This action will permanently remove this device from your registered devices.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#111113] p-4">
              <p className="text-sm font-medium text-white">
                {deleteTarget.nama}
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                {deleteTarget.lokasi}
              </p>

              <p className="mt-2 text-[11px] font-medium text-zinc-600">
                {getDisplayCode(deleteTarget)}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}

                {deletingId ? "Deleting..." : "Delete Device"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE DETAIL MODAL */}

      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c20] p-6 shadow-2xl">

            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-white">
                Device Details
              </h2>

              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-purple-500/10 p-3 text-purple-400">
                <Monitor size={25} />
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  {selectedDevice.nama}
                </h3>

                <p className="text-xs font-medium tracking-wide text-zinc-500">
                  {getDisplayCode(selectedDevice)}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Location</span>

                <span className="text-right text-zinc-200">
                  {selectedDevice.lokasi}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Device Type</span>

                <span className="text-right text-zinc-200">
                  Digital Signage
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Status</span>

                <StatusBadge status={selectedDevice.status} />
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Last Seen</span>

                <span className="text-right text-zinc-200">
                  {formatLastSeen(selectedDevice.last_seen)}
                </span>
              </div>

              <div className="border-t border-white/[0.07] pt-4">
                <p className="mb-1 text-xs text-zinc-500">
                  Device UUID
                </p>

                <p className="break-all font-mono text-[11px] text-zinc-400">
                  {selectedDevice.id}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDevice(null)}
              className="mt-7 w-full rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-500"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
