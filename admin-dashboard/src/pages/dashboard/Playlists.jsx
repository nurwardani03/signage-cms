
import { useCallback, useEffect, useState } from "react";
import {
  ListVideo,
  Plus,
  Trash2,
  Search,
  Image as ImageIcon,
  Video,
  FileText,
  Clock,
  GripVertical,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { apiFetch, API_URL } from "../../lib/api";

function getMediaType(content) {
  const mime =
    content?.payload?.mimeType ||
    content?.payload?.mime_type ||
    "";

  const type = (content?.tipe || "").toLowerCase();

  if (mime.startsWith("video/") || type === "video") return "video";
  if (mime === "application/pdf" || type === "pdf") return "pdf";

  return "image";
}

function MediaIcon({ type, size = 17 }) {
  if (type === "video") return <Video size={size} />;
  if (type === "pdf") return <FileText size={size} />;
  return <ImageIcon size={size} />;
}

function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  // =====================================
  // FETCH PLAYLISTS & MEDIA
  // =====================================

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [playlistResponse, contentResponse] = await Promise.all([
        apiFetch(`${API_URL}/api/playlists`),
        apiFetch(`${API_URL}/api/contents`),
      ]);

      const playlistResult = await playlistResponse.json();
      const contentResult = await contentResponse.json();

      if (!playlistResponse.ok || !playlistResult.success) {
        throw new Error(
          playlistResult.message || "Gagal memuat playlist."
        );
      }

      if (!contentResponse.ok || !contentResult.success) {
        throw new Error(
          contentResult.message || "Gagal memuat media."
        );
      }

      setPlaylists(playlistResult.data || []);
      setContents(contentResult.data || []);
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =====================================
  // FORM MANAGEMENT
  // =====================================

  const resetForm = () => {
    setPlaylistName("");
    setDescription("");
    setSelectedItems([]);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
    setMessage(null);
  };

  // =====================================
  // SELECT MEDIA
  // =====================================

  const toggleMedia = (content) => {
    setSelectedItems((current) => {
      const exists = current.some(
        (item) => item.contentId === content.id
      );

      if (exists) {
        return current.filter(
          (item) => item.contentId !== content.id
        );
      }

      return [
        ...current,
        {
          contentId: content.id,
          duration: 10,
        },
      ];
    });
  };

  // =====================================
  // UPDATE DURATION
  // =====================================

  const updateDuration = (contentId, duration) => {
    setSelectedItems((current) =>
      current.map((item) =>
        item.contentId === contentId
          ? {
              ...item,
              duration: Math.max(1, Number(duration) || 1),
            }
          : item
      )
    );
  };

  // =====================================
  // REORDER PLAYLIST ITEMS
  // =====================================

  const moveItem = (index, direction) => {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= selectedItems.length) {
      return;
    }

    setSelectedItems((current) => {
      const updated = [...current];

      [updated[index], updated[targetIndex]] = [
        updated[targetIndex],
        updated[index],
      ];

      return updated;
    });
  };

  // =====================================
  // CREATE PLAYLIST
  // =====================================

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!playlistName.trim()) {
      showMessage("error", "Nama playlist wajib diisi.");
      return;
    }

    if (selectedItems.length === 0) {
      showMessage("error", "Pilih minimal satu media.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await apiFetch(`${API_URL}/api/playlists`, {
        method: "POST",
        body: JSON.stringify({
          nama: playlistName.trim(),
          deskripsi: description.trim(),
          items: selectedItems,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal membuat playlist."
        );
      }

      setPlaylists((current) => [
        ...current,
        result.data,
      ]);

      setShowModal(false);
      resetForm();

      showMessage(
        "success",
        result.message || "Playlist berhasil dibuat."
      );
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // DELETE PLAYLIST
  // =====================================

  const handleDelete = async (playlist) => {
    const confirmed = window.confirm(
      `Hapus playlist "${playlist.nama}"?`
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(
        `${API_URL}/api/playlists/${playlist.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal menghapus playlist."
        );
      }

      setPlaylists((current) =>
        current.filter((item) => item.id !== playlist.id)
      );

      showMessage(
        "success",
        result.message || "Playlist berhasil dihapus."
      );
    } catch (error) {
      showMessage("error", error.message);
    }
  };

  // =====================================
  // SEARCH
  // =====================================

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.nama?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMedia = selectedItems.length;

  // =====================================
  // MAIN UI
  // =====================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Playlist Management
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            Create and organize media playlists for your signage devices.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus size={17} />
          Create Playlist
        </button>
      </div>

      {/* NOTIFICATION */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          {message.text}

          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#19191d] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-3 text-purple-400">
              <ListVideo size={22} />
            </div>

            <div>
              <p className="text-sm text-zinc-400">
                Total Playlists
              </p>

              <h2 className="text-2xl font-bold text-white">
                {playlists.length}
              </h2>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#19191d] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-3 text-blue-400">
              <ImageIcon size={22} />
            </div>

            <div>
              <p className="text-sm text-zinc-400">
                Available Media
              </p>

              <h2 className="text-2xl font-bold text-white">
                {contents.length}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* PLAYLIST LIST */}
      <section className="rounded-xl border border-white/10 bg-[#19191d] p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">
              Your Playlists
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Manage your saved media sequences.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="relative mb-5">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search playlist..."
            className="w-full rounded-lg border border-white/10 bg-[#222228] py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-purple-500"
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            Loading playlists...
          </div>
        ) : filteredPlaylists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-16 text-center">
            <ListVideo
              size={38}
              className="mx-auto mb-3 text-zinc-500"
            />

            <p className="font-medium text-white">
              No playlists found
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Create your first playlist to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                className="rounded-xl border border-white/10 bg-[#222228] p-4"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-lg bg-purple-500/10 p-3 text-purple-400">
                    <ListVideo size={21} />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(playlist)}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                    title="Delete playlist"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <h3 className="font-semibold text-white">
                  {playlist.nama}
                </h3>

                <p className="mt-1 min-h-5 text-xs text-zinc-500">
                  {playlist.deskripsi || "No description"}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <ListVideo size={14} />
                    {playlist.items?.length || 0} media
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {(playlist.items || []).reduce(
                      (total, item) =>
                        total + Number(item.duration || 0),
                      0
                    )}{" "}
                    seconds
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {(playlist.items || []).map((item, index) => {
                    const content = contents.find(
                      (media) => media.id === item.contentId
                    );

                    return (
                      <div
                        key={`${item.contentId}-${index}`}
                        className="flex items-center gap-2 rounded-lg bg-[#19191d] p-2"
                      >
                        <span className="text-xs text-zinc-500">
                          {index + 1}.
                        </span>

                        <MediaIcon
                          type={getMediaType(content)}
                          size={14}
                        />

                        <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                          {content?.judul || "Media not found"}
                        </span>

                        <span className="text-xs text-zinc-500">
                          {item.duration}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CREATE PLAYLIST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#19191d] shadow-2xl">

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Create New Playlist
                </h2>

                <p className="mt-1 text-xs text-zinc-400">
                  Select multiple media and arrange their playback order.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            {/* MODAL BODY */}
            <form
              onSubmit={handleCreate}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-5 overflow-y-auto p-5">

                {/* PLAYLIST NAME */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Playlist Name
                  </label>

                  <input
                    value={playlistName}
                    onChange={(event) =>
                      setPlaylistName(event.target.value)
                    }
                    placeholder="Example: Lobby Display"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#222228] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                  />
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Description
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder="Describe this playlist..."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-white/10 bg-[#222228] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                  />
                </div>

                {/* MEDIA SELECTION */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300">
                      Select Media
                    </label>

                    <span className="text-xs text-purple-400">
                      {totalMedia} selected
                    </span>
                  </div>

                  {contents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                      No media available. Upload media first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {contents.map((content) => {
                        const selected = selectedItems.some(
                          (item) => item.contentId === content.id
                        );

                        const type = getMediaType(content);

                        return (
                          <button
                            type="button"
                            key={content.id}
                            onClick={() => toggleMedia(content)}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                              selected
                                ? "border-purple-500 bg-purple-500/10"
                                : "border-white/10 bg-[#222228] hover:border-white/30"
                            }`}
                          >
                            <div className="rounded-lg bg-white/5 p-2 text-purple-300">
                              <MediaIcon type={type} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">
                                {content.judul}
                              </p>

                              <p className="text-xs uppercase text-zinc-500">
                                {type}
                              </p>
                            </div>

                            <div
                              className={`h-4 w-4 rounded border ${
                                selected
                                  ? "border-purple-500 bg-purple-500"
                                  : "border-zinc-600"
                              }`}
                            >
                              {selected && (
                                <CheckCircle2
                                  size={14}
                                  className="text-white"
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ORDER & DURATION */}
                {selectedItems.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-300">
                        Playlist Sequence
                      </label>

                      <span className="text-xs text-zinc-500">
                        Use arrows to reorder
                      </span>
                    </div>

                    <div className="space-y-2">
                      {selectedItems.map((item, index) => {
                        const content = contents.find(
                          (media) => media.id === item.contentId
                        );

                        return (
                          <div
                            key={item.contentId}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-[#222228] p-3"
                          >
                            <GripVertical
                              size={17}
                              className="text-zinc-500"
                            />

                            <span className="text-xs text-zinc-500">
                              {index + 1}.
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white">
                                {content?.judul}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs text-zinc-500">
                                Duration
                              </label>

                              <input
                                type="number"
                                min="1"
                                value={item.duration}
                                onChange={(event) =>
                                  updateDuration(
                                    item.contentId,
                                    event.target.value
                                  )
                                }
                                className="w-16 rounded-lg border border-white/10 bg-[#19191d] px-2 py-2 text-center text-sm text-white outline-none focus:border-purple-500"
                              />

                              <span className="text-xs text-zinc-500">
                                sec
                              </span>
                            </div>

                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveItem(index, -1)}
                                className="rounded bg-white/5 px-2 py-1 text-xs text-zinc-300 disabled:opacity-30"
                                title="Move up"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                disabled={
                                  index === selectedItems.length - 1
                                }
                                onClick={() => moveItem(index, 1)}
                                className="rounded bg-white/5 px-2 py-1 text-xs text-zinc-300 disabled:opacity-30"
                                title="Move down"
                              >
                                ↓
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleMedia(content)}
                                className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400"
                                title="Remove media"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-xs text-zinc-500">
                      Total playback duration:{" "}
                      {selectedItems.reduce(
                        (total, item) =>
                          total + Number(item.duration || 0),
                        0
                      )}{" "}
                      seconds per loop.
                    </p>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 p-5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || selectedItems.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={16} />
                  {saving ? "Creating..." : "Create Playlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Playlists;
