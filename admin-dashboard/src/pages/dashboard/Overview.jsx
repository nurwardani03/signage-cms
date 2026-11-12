
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Monitor,
  Wifi,
  WifiOff,
  Image as ImageIcon,
  RefreshCw,
  Activity,
  MapPin,
  Clock3,
  Play,
  ListVideo,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import {
  apiFetch,
  createAdminSocket,
  API_URL,
} from "../../lib/api";

const COLORS = ["#22c55e", "#ef4444"];

function formatLastSeen(value) {
  if (!value) return "Never connected";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5 transition hover:border-purple-500/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-400">
            {title}
          </p>

          <h3 className="mt-3 text-3xl font-bold text-white">
            {value}
          </h3>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">{subtitle}</p>
    </div>
  );
}

export default function Overview() {
  const [devices, setDevices] = useState([]);
  const [contents, setContents] = useState([]);
  const [deviceContents, setDeviceContents] = useState({});
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const devicesRef = useRef([]);

  const onlineDevices = devices.filter(
    (device) => device.status === "online"
  ).length;

  const offlineDevices = devices.length - onlineDevices;

  const chartData = [
    { name: "Online", value: onlineDevices },
    { name: "Offline", value: offlineDevices },
  ].filter((item) => item.value > 0);

  // FETCH DASHBOARD DATA
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [deviceResponse, contentResponse] = await Promise.all([
        apiFetch(`${API_URL}/api/devices`),
        apiFetch(`${API_URL}/api/contents`),
      ]);

      const deviceResult = await deviceResponse.json();
      const contentResult = await contentResponse.json();

      if (!deviceResponse.ok || !deviceResult.success) {
        throw new Error(
          deviceResult.message || "Gagal mengambil data device."
        );
      }

      if (!contentResponse.ok || !contentResult.success) {
        throw new Error(
          contentResult.message || "Gagal mengambil data konten."
        );
      }

      const deviceList = deviceResult.data || [];

      devicesRef.current = deviceList;
      setDevices(deviceList);
      setContents(contentResult.data || []);

      return deviceList;
    } catch (err) {
      setError(err.message || "Gagal memuat dashboard.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // NORMALIZE ASSIGNMENT RESPONSE
  const normalizeAssignment = useCallback((response) => {
    if (!response?.success) return null;

    const playlist = response.playlist || null;
    const content = response.data || response.content || null;

    if (playlist) {
      return {
        type: "playlist",
        content: null,
        playlist,
        pending: Boolean(response.pending),
      };
    }

    if (content) {
      return {
        type: "single",
        content,
        playlist: null,
        pending: Boolean(response.pending),
      };
    }

    return {
      type: null,
      content: null,
      playlist: null,
      pending: Boolean(response.pending),
    };
  }, []);

  // GET CURRENT CONTENT PER DEVICE
  const fetchDeviceContents = useCallback(
    (deviceList) => {
      const socket = socketRef.current;

      if (!socket?.connected || !deviceList?.length) return;

      deviceList.forEach((device) => {
        socket.emit(
          "admin:get-current-content",
          { deviceId: device.id },
          (response) => {
            if (!response?.success) return;

            const assignment = normalizeAssignment(response);

            setDeviceContents((previous) => ({
              ...previous,
              [device.id]: assignment,
            }));
          }
        );
      });
    },
    [normalizeAssignment]
  );

  // INITIAL DATA
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // SOCKET.IO REALTIME ADMIN
  useEffect(() => {
    const socket = createAdminSocket();

    socketRef.current = socket;

    socket.on("connect", async () => {
      setSocketConnected(true);

      const deviceList = await fetchDashboardData();

      if (deviceList.length > 0) {
        fetchDeviceContents(deviceList);
      }
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("connect_error", (err) => {
      setSocketConnected(false);
      setError(err.message || "Admin socket connection failed.");
    });

    // Update device status
    socket.on("devices:status", (updatedDevice) => {
      setDevices((previous) => {
        const updated = previous.map((device) =>
          device.id === updatedDevice.id
            ? { ...device, ...updatedDevice }
            : device
        );

        devicesRef.current = updated;
        return updated;
      });
    });

    // Update content or playlist assignment
    socket.on("devices:content-status", (payload) => {
      if (!payload?.deviceId) return;

      const assignment = normalizeAssignment({
        success: true,
        data: payload.content || null,
        playlist: payload.playlist || null,
        pending: payload.pending,
      });

      setDeviceContents((previous) => ({
        ...previous,
        [payload.deviceId]: assignment,
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    fetchDashboardData,
    fetchDeviceContents,
    normalizeAssignment,
  ]);

  // REFRESH DASHBOARD
  const handleRefresh = async () => {
    const deviceList = await fetchDashboardData();

    if (socketRef.current?.connected && deviceList.length > 0) {
      fetchDeviceContents(deviceList);
    }
  };

  return (
    <div className="space-y-7">

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            Overview of your company's digital signage network.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#19191d] px-3 py-2">
            <span
              className={`h-2 w-2 rounded-full ${
                socketConnected
                  ? "animate-pulse bg-green-500"
                  : "bg-red-500"
              }`}
            />

            <span
              className={`text-xs font-medium ${
                socketConnected ? "text-green-400" : "text-red-400"
              }`}
            >
              {socketConnected ? "Realtime Connected" : "Disconnected"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#19191d] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="TOTAL SCREENS"
          value={loading ? "..." : devices.length}
          subtitle="Registered devices"
          icon={Monitor}
          color="bg-blue-500/10 text-blue-400"
        />

        <StatCard
          title="LIVE SCREENS"
          value={loading ? "..." : onlineDevices}
          subtitle="Currently connected devices"
          icon={Wifi}
          color="bg-green-500/10 text-green-400"
        />

        <StatCard
          title="OFFLINE SCREENS"
          value={loading ? "..." : offlineDevices}
          subtitle="Currently disconnected devices"
          icon={WifiOff}
          color="bg-red-500/10 text-red-400"
        />

        <StatCard
          title="TOTAL CONTENTS"
          value={loading ? "..." : contents.length}
          subtitle="Available media contents"
          icon={ImageIcon}
          color="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* NETWORK OVERVIEW */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">

        {/* DEVICE STATUS CHART */}
        <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">
              Device Status
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Current device connectivity overview.
            </p>
          </div>

          <div className="h-[220px]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Loading chart...
              </div>
            ) : devices.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                No device data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={COLORS[index]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#222228",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Online ({onlineDevices})
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Offline ({offlineDevices})
            </div>
          </div>
        </div>

        {/* NETWORK SUMMARY */}
        <div className="xl:col-span-2 rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">
              Network Overview
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Summary of your digital signage network.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div className="rounded-xl border border-white/[0.06] bg-[#222228] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                  Device Availability
                </span>

                <Activity size={18} className="text-green-400" />
              </div>

              <p className="text-3xl font-bold text-white">
                {devices.length
                  ? `${Math.round(
                      (onlineDevices / devices.length) * 100
                    )}%`
                  : "0%"}
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                Devices currently online
              </p>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${
                      devices.length
                        ? (onlineDevices / devices.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#222228] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                  Media Library
                </span>

                <ImageIcon size={18} className="text-purple-400" />
              </div>

              <p className="text-3xl font-bold text-white">
                {contents.length}
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                Total media files available for publishing
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs text-purple-400">
                <CheckCircle2 size={14} />
                Synced from database
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#222228] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">
                  Realtime Monitoring
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  Device status updates through Socket.IO
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  socketConnected
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {socketConnected ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DEVICE TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#19191d]">

        <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">
                Connected Devices
              </h2>

              <span className="rounded-md bg-purple-500/10 px-2 py-1 text-[10px] font-medium text-purple-400">
                LIVE
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              Actual device information from your database.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Monitor size={15} />
            {devices.length} registered devices
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#222228] text-xs text-zinc-400">
              <tr>
                <th className="px-5 py-4 font-medium">Device</th>
                <th className="px-5 py-4 font-medium">Location</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Assigned Content</th>
                <th className="px-5 py-4 font-medium">Last Sync</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-5 py-12 text-center text-sm text-zinc-500"
                  >
                    Loading device data...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-5 py-12 text-center text-sm text-zinc-500"
                  >
                    No devices registered yet.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const assignment = deviceContents[device.id];

                  const assignedContent = assignment?.content;
                  const assignedPlaylist = assignment?.playlist;

                  return (
                    <tr
                      key={device.id}
                      className="transition hover:bg-white/[0.025]"
                    >
                      {/* DEVICE */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                            <Monitor size={19} />
                          </div>

                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              {device.nama}
                            </p>

                            <p className="mt-1 text-[11px] text-zinc-500">
                              {device.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* LOCATION */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <MapPin size={14} />
                          {device.lokasi}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                            device.status === "online"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              device.status === "online"
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />

                          {device.status === "online" ? "Online" : "Offline"}
                        </span>
                      </td>

                      {/* ASSIGNED CONTENT */}
                      <td className="px-5 py-4">
                        {assignedContent || assignedPlaylist ? (
                          <div>
                            <div className="flex items-center gap-2 text-xs text-zinc-300">
                              {assignedPlaylist ? (
                                <ListVideo
                                  size={14}
                                  className="text-purple-400"
                                />
                              ) : (
                                <Play
                                  size={13}
                                  className="text-purple-400"
                                />
                              )}

                              <span className="max-w-[200px] truncate">
                                {assignedPlaylist
                                  ? assignedPlaylist.nama
                                  : assignedContent.judul}
                              </span>
                            </div>

                            <span className="mt-1 inline-block text-[10px] text-zinc-500">
                              {assignedPlaylist
                                ? `${assignedPlaylist.items?.length || 0} media · Playlist`
                                : "Single Content"}
                            </span>

                            {assignment?.pending && (
                              <span className="mt-1 block text-[10px] text-amber-400">
                                Waiting for device
                              </span>
                            )}
                          </div>
                        ) : assignment ? (
                          <span className="text-xs text-zinc-500">
                            No content assigned
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Checking assignment...
                          </span>
                        )}
                      </td>

                      {/* LAST SYNC */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Clock3 size={14} />
                          {formatLastSeen(device.last_seen)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-4">
          <p className="text-xs text-zinc-500">
            Showing {devices.length} registered devices
          </p>

          <p className="text-xs text-zinc-500">
            {onlineDevices} Online · {offlineDevices} Offline
          </p>
        </div>
      </div>
    </div>
  );
}
