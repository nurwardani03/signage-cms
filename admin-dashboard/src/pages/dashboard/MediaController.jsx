import { useCallback, useEffect, useRef, useState } from "react";
import {
  Monitor,
  Image,
  Video,
  FileText,
  Play,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  ListVideo,
  Clock,
  Trash2,
} from "lucide-react";

import {
  apiFetch,
  createAdminSocket,
  API_URL,
} from "../../lib/api";

// =====================================
// HELPER FUNCTIONS
// =====================================

function getMediaType(content) {
  const mime = (
    content?.payload?.mime_type ||
    content?.payload?.mimeType ||
    ""
  ).toLowerCase();

  const type = (content?.tipe || "").toLowerCase();

  if (mime.startsWith("video/") || type === "video") {
    return "video";
  }

  if (mime === "application/pdf" || type === "pdf") {
    return "pdf";
  }

  return "image";
}

function normalizeAssignment(response) {
  if (response?.playlist) {
    return {
      type: "playlist",
      title: response.playlist.nama,
      data: response.playlist,
      pending: Boolean(response.pending),
    };
  }

  const content = response?.data || response?.content;

  if (content) {
    return {
      type: "single",
      title: content.judul,
      data: content,
      pending: Boolean(response.pending),
    };
  }

  return null;
}

// =====================================
// MEDIA CONTROLLER
// =====================================

export default function MediaController() {
  const [devices, setDevices] = useState([]);
  const [contents, setContents] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  const [selectedDevice, setSelectedDevice] = useState("");
  const [mode, setMode] = useState("single");
  const [selectedMedia, setSelectedMedia] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const [message, setMessage] = useState(null);
  const [currentAssignments, setCurrentAssignments] = useState({});

  const socketRef = useRef(null);

  // =====================================
  // NOTIFICATION
  // =====================================

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
  }, []);

  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [message]);

  // =====================================
  // FETCH DASHBOARD DATA
  // =====================================

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [deviceResponse, contentResponse, playlistResponse] =
        await Promise.all([
          apiFetch(`${API_URL}/api/devices`),
          apiFetch(`${API_URL}/api/contents`),
          apiFetch(`${API_URL}/api/playlists`),
        ]);

      const [deviceResult, contentResult, playlistResult] =
        await Promise.all([
          deviceResponse.json(),
          contentResponse.json(),
          playlistResponse.json(),
        ]);

      if (!deviceResponse.ok || !deviceResult.success) {
        throw new Error(
          deviceResult.message || "Failed to load devices."
        );
      }

      if (!contentResponse.ok || !contentResult.success) {
        throw new Error(
          contentResult.message || "Failed to load media."
        );
      }

      if (!playlistResponse.ok || !playlistResult.success) {
        throw new Error(
          playlistResult.message || "Failed to load playlists."
        );
      }

      const deviceList = deviceResult.data || [];

      setDevices(deviceList);
      setContents(contentResult.data || []);
      setPlaylists(playlistResult.data || []);

      return deviceList;
    } catch (error) {
      showMessage(
        "error",
        error.message || "Failed to load dashboard data."
      );

      return [];
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  // =====================================
  // FETCH ASSIGNMENT FOR ALL DEVICES
  // =====================================

  const fetchDeviceAssignments = useCallback((deviceList, socket) => {
    if (!socket?.connected || !deviceList?.length) return;

    deviceList.forEach((device) => {
      socket.emit(
        "admin:get-current-content",
        { deviceId: device.id },
        (response) => {
          if (!response?.success) return;

          const assignment = normalizeAssignment(response);

          setCurrentAssignments((current) => ({
            ...current,
            [device.id]: assignment,
          }));
        }
      );
    });
  }, []);

  // =====================================
  // SOCKET CONNECTION
  // =====================================

  useEffect(() => {
    let mounted = true;

    // Admin socket automatically sends JWT token.
    const socket = createAdminSocket();

    socketRef.current = socket;

    const loadInitialData = async () => {
      const deviceList = await fetchData();

      if (mounted && socket.connected) {
        fetchDeviceAssignments(deviceList, socket);
      }
    };

    socket.on("connect", () => {
      if (!mounted) return;

      setSocketConnected(true);
      loadInitialData();
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Media Controller Socket Error:", error);
      setSocketConnected(false);
    });

    // Update device status.
    socket.on("devices:status", (updatedDevice) => {
      setDevices((current) =>
        current.map((device) =>
          device.id === updatedDevice.id
            ? { ...device, ...updatedDevice }
            : device
        )
      );
    });

    // Update assignment when content is published.
    socket.on("devices:content-status", (payload) => {
      if (!payload?.deviceId) return;

      setCurrentAssignments((current) => ({
        ...current,
        [payload.deviceId]: normalizeAssignment({
          content: payload.content,
          playlist: payload.playlist,
          pending: payload.pending,
        }),
      }));
    });

    // Initial fetch if socket is already connected.
    if (socket.connected) {
      loadInitialData();
    }

    return () => {
      mounted = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchData, fetchDeviceAssignments]);

  // =====================================
  // CURRENT DATA
  // =====================================

  const filteredContents = contents.filter((content) =>
    content.judul?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedContent = contents.find(
    (content) => content.id === selectedMedia
  );

  const selectedPlaylistData = playlists.find(
    (playlist) => playlist.id === selectedPlaylist
  );

  const activeAssignment = currentAssignments[selectedDevice];

  // =====================================
  // DEVICE SELECTION
  // =====================================

  const handleDeviceChange = (deviceId) => {
    setSelectedDevice(deviceId);

    if (!deviceId) return;

    const socket = socketRef.current;

    if (!socket?.connected) {
      showMessage("error", "Realtime connection is unavailable.");
      return;
    }

    socket.emit(
      "admin:get-current-content",
      { deviceId },
      (response) => {
        if (!response?.success) {
          showMessage(
            "error",
            response?.message || "Failed to retrieve device content."
          );

          return;
        }

        setCurrentAssignments((current) => ({
          ...current,
          [deviceId]: normalizeAssignment(response),
        }));
      }
    );
  };

  // =====================================
  // PUBLISH CONTENT
  // =====================================

  const handlePublish = () => {
    if (!selectedDevice) {
      showMessage("error", "Please select a device first.");
      return;
    }

    if (mode === "single" && !selectedMedia) {
      showMessage("error", "Please select media first.");
      return;
    }

    if (mode === "playlist" && !selectedPlaylist) {
      showMessage("error", "Please select a playlist first.");
      return;
    }

    const device = devices.find(
      (item) => item.id === selectedDevice
    );

    if (!device) {
      showMessage("error", "Device not found.");
      return;
    }

    const socket = socketRef.current;

    if (!socket?.connected) {
      showMessage("error", "Realtime connection is unavailable.");
      return;
    }

    setPublishing(true);
    setMessage(null);

    const eventName =
      mode === "playlist"
        ? "admin:publish-playlist"
        : "admin:publish";

    const payload =
      mode === "playlist"
        ? {
            deviceId: selectedDevice,
            playlistId: selectedPlaylist,
          }
        : {
            deviceId: selectedDevice,
            contentId: selectedMedia,
          };

    socket.emit(eventName, payload, (response) => {
      setPublishing(false);

      if (!response?.success) {
        showMessage(
          "error",
          response?.message || "Failed to publish content."
        );

        return;
      }

      const assignment =
        mode === "playlist"
          ? {
              type: "playlist",
              title: selectedPlaylistData?.nama || "Playlist",
              data: response.data?.playlist || selectedPlaylistData,
              pending: Boolean(response.pending),
            }
          : {
              type: "single",
              title: selectedContent?.judul || "Content",
              data: response.data?.content || selectedContent,
              pending: Boolean(response.pending),
            };

      setCurrentAssignments((current) => ({
        ...current,
        [selectedDevice]: assignment,
      }));

      showMessage(
        "success",
        response.message ||
          `Content successfully sent to ${device.nama}.`
      );
    });
  };

  // =====================================
  // REMOVE CONTENT
  // =====================================

  const handleRemoveContent = () => {
    if (!selectedDevice) {
      showMessage("error", "Please select a device first.");
      return;
    }

    if (!currentAssignments[selectedDevice]) {
      showMessage("error", "No assigned content found for this device.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove the assigned content from this device?"
    );

    if (!confirmed) return;

    const socket = socketRef.current;

    if (!socket?.connected) {
      showMessage("error", "Realtime connection is unavailable.");
      return;
    }

    setRemoving(true);

    socket.emit(
      "admin:remove-content",
      { deviceId: selectedDevice },
      (response) => {
        setRemoving(false);

        if (!response?.success) {
          showMessage(
            "error",
            response?.message || "Failed to remove content."
          );

          return;
        }

        setCurrentAssignments((current) => ({
          ...current,
          [selectedDevice]: null,
        }));

        showMessage(
          "success",
          response.message || "Content successfully removed."
        );
      }
    );
  };

  // =====================================
  // RENDER
  // =====================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Media Controller
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            Manage and control media displayed on your signage devices.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#19191d] px-3 py-2 text-xs">
          {socketConnected ? (
            <>
              <Wifi size={15} className="text-emerald-400" />
              <span className="text-emerald-400">
                Realtime Connected
              </span>
            </>
          ) : (
            <>
              <WifiOff size={15} className="text-red-400" />
              <span className="text-red-400">
                Realtime Disconnected
              </span>
            </>
          )}
        </div>
      </div>

      {/* CENTER POPUP NOTIFICATION */}
      {message && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setMessage(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#202027] p-6 text-center shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 size={30} />
              ) : (
                <AlertCircle size={30} />
              )}
            </div>

            <h3 className="text-lg font-semibold text-white">
              {message.type === "success"
                ? "Success"
                : "Something went wrong"}
            </h3>

            <p className="mt-2 break-words text-sm leading-6 text-zinc-400">
              {message.text}
            </p>

            <button
              type="button"
              onClick={() => setMessage(null)}
              className="mt-5 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* DEVICE SELECTION */}
      <section className="rounded-xl border border-white/10 bg-[#19191d] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Monitor size={20} className="text-purple-400" />

          <h2 className="font-semibold text-white">
            Select Device
          </h2>

          <span className="ml-auto text-xs text-zinc-500">
            {devices.length} devices
          </span>
        </div>

        <select
          value={selectedDevice}
          onChange={(event) => handleDeviceChange(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-[#222228] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
        >
          <option value="">Choose a signage device</option>

          {devices.map((device) => {
            const assignment = currentAssignments[device.id];

            return (
              <option key={device.id} value={device.id}>
                {device.nama} — {device.lokasi} ({device.status})
                {" | "}
                {assignment ? assignment.title : "No Content"}
              </option>
            );
          })}
        </select>

        {selectedDevice && (
          <>
            <p className="mt-3 text-xs">
              {devices.find((item) => item.id === selectedDevice)?.status ===
              "online" ? (
                <span className="text-emerald-400">
                  ● Device Online
                </span>
              ) : (
                <span className="text-zinc-500">
                  ● Device Offline
                </span>
              )}
            </p>

            <div className="mt-4 rounded-lg border border-white/10 bg-[#222228] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">
                  Current Device Content
                </h3>

                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    activeAssignment
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-zinc-500/10 text-zinc-400"
                  }`}
                >
                  {activeAssignment ? "HAS CONTENT" : "EMPTY"}
                </span>
              </div>

              {activeAssignment ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {activeAssignment.title}
                    </p>

                    <p className="mt-1 text-xs text-zinc-400">
                      {activeAssignment.type === "playlist"
                        ? `${
                            activeAssignment.data?.items?.length || 0
                          } items in this playlist`
                        : "Single Content"}
                    </p>

                    {activeAssignment.pending && (
                      <p className="mt-1 text-xs text-amber-400">
                        Waiting for the device to come online and receive
                        the content.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveContent}
                    disabled={removing}
                    className="flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {removing ? "Removing..." : "Remove Content"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No content is currently assigned to this device.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* PLAYBACK MODE */}
      <section className="rounded-xl border border-white/10 bg-[#19191d] p-5">
        <h2 className="mb-4 font-semibold text-white">
          Playback Mode
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
              mode === "single"
                ? "border-purple-500 bg-purple-500/10"
                : "border-white/10 bg-[#222228] hover:border-white/30"
            }`}
          >
            <Image size={22} className="text-purple-400" />

            <div>
              <p className="text-sm font-semibold text-white">
                Single Content
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Display one selected media.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("playlist")}
            className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
              mode === "playlist"
                ? "border-purple-500 bg-purple-500/10"
                : "border-white/10 bg-[#222228] hover:border-white/30"
            }`}
          >
            <ListVideo size={22} className="text-purple-400" />

            <div>
              <p className="text-sm font-semibold text-white">
                Playlist
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Play multiple media in sequence.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* SINGLE CONTENT */}
      {mode === "single" && (
        <section className="rounded-xl border border-white/10 bg-[#19191d] p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">
                Select Media
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                Choose media from your Media Library.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          <div className="relative mb-4">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search media..."
              className="w-full rounded-lg border border-white/10 bg-[#222228] py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-purple-500"
            />
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-zinc-400">
              Loading media...
            </div>
          ) : filteredContents.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 text-center">
              <Image size={32} className="mb-3 text-zinc-500" />

              <p className="text-sm font-medium text-white">
                No media available
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Upload media first from Media Library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredContents.map((content) => {
                const type = getMediaType(content);
                const url = content.payload?.url || "";
                const active = selectedMedia === content.id;

                return (
                  <button
                    type="button"
                    key={content.id}
                    onClick={() => setSelectedMedia(content.id)}
                    className={`overflow-hidden rounded-xl border text-left transition ${
                      active
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-white/10 bg-[#222228] hover:border-white/30"
                    }`}
                  >
                    <div className="relative flex h-40 items-center justify-center overflow-hidden bg-[#111113]">
                      {type === "image" && url ? (
                        <img
                          src={url}
                          alt={content.judul}
                          className="h-full w-full object-contain"
                        />
                      ) : type === "video" && url ? (
                        <video
                          src={url}
                          className="h-full w-full object-contain"
                          muted
                        />
                      ) : (
                        <FileText
                          size={40}
                          className="text-zinc-500"
                        />
                      )}

                      <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] uppercase text-white">
                        {type === "video" ? (
                          <Video size={12} className="inline" />
                        ) : type === "pdf" ? (
                          <FileText size={12} className="inline" />
                        ) : (
                          <Image size={12} className="inline" />
                        )}
                        {" "}
                        {type}
                      </span>

                      {active && (
                        <span className="absolute right-3 top-3 rounded-full bg-purple-600 p-1">
                          <CheckCircle2
                            size={16}
                            className="text-white"
                          />
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="truncate text-sm font-semibold text-white">
                        {content.judul}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        {content.payload?.original_name || content.tipe}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedContent && (
            <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 text-sm text-white">
                <Play size={16} className="text-purple-400" />
                Selected: {selectedContent.judul}
              </div>
            </div>
          )}
        </section>
      )}

      {/* PLAYLIST SELECTION */}
      {mode === "playlist" && (
        <section className="rounded-xl border border-white/10 bg-[#19191d] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">
                Select Playlist
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                Choose a playlist created in Playlist Management.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {playlists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-12 text-center">
              <ListVideo
                size={34}
                className="mx-auto mb-3 text-zinc-500"
              />

              <p className="text-sm font-medium text-white">
                No playlists available
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Create a playlist first in Playlist Management.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {playlists.map((playlist) => {
                const active = selectedPlaylist === playlist.id;

                const duration = (playlist.items || []).reduce(
                  (total, item) => total + Number(item.duration || 0),
                  0
                );

                return (
                  <button
                    type="button"
                    key={playlist.id}
                    onClick={() => setSelectedPlaylist(playlist.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-white/10 bg-[#222228] hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-500/10 p-3 text-purple-400">
                        <ListVideo size={22} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">
                          {playlist.nama}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {playlist.deskripsi || "No description"}
                        </p>
                      </div>

                      {active && (
                        <CheckCircle2
                          size={20}
                          className="text-purple-400"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex gap-4 border-t border-white/10 pt-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <ListVideo size={14} />
                        {playlist.items?.length || 0} media
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {duration} seconds per loop
                      </span>
                    </div>

                    {active && (
                      <div className="mt-3 space-y-2">
                        {(playlist.items || []).map((item, index) => {
                          const media = contents.find(
                            (content) => content.id === item.contentId
                          );

                          return (
                            <div
                              key={`${item.contentId}-${index}`}
                              className="flex items-center gap-2 rounded-md bg-[#19191d] px-3 py-2 text-xs"
                            >
                              <span className="text-zinc-500">
                                {index + 1}.
                              </span>

                              <span className="flex-1 truncate text-zinc-300">
                                {media?.judul || "Media not found"}
                              </span>

                              <span className="text-zinc-500">
                                {item.duration}s
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PUBLISH */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
        <div>
          <h2 className="font-semibold text-white">
            Publish to Device
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            {mode === "playlist"
              ? `Send ${
                  selectedPlaylistData?.nama || "selected playlist"
                } to your signage device.`
              : "Send selected media to your signage screen."}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={
            !selectedDevice ||
            (mode === "single" && !selectedMedia) ||
            (mode === "playlist" && !selectedPlaylist) ||
            publishing ||
            !socketConnected
          }
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={16} />

          {publishing
            ? "Publishing..."
            : activeAssignment
              ? "Update Content"
              : "Publish Content"}
        </button>
      </section>
    </div>
  );
}