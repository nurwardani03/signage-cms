
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, API_URL } from "../../lib/api";
import {
  Upload,
  Search,
  RefreshCw,
  Image as ImageIcon,
  Video,
  FileText,
  File,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Eye,
  ExternalLink,
  FolderOpen,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Film,
  HardDrive,
} from "lucide-react";

const formatSize = (bytes = 0) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getMediaType = (content) => {
  const mimeType = content?.payload?.mimeType || "";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";

  return content?.tipe || "file";
};

const getMediaIcon = (type, size = 20) => {
  if (type === "image") return <ImageIcon size={size} />;
  if (type === "video") return <Video size={size} />;
  if (type === "pdf") return <FileText size={size} />;
  return <File size={size} />;
};

const getMediaUrl = (content) => content?.payload?.url || "";

function MediaLibrary() {
  const fileInputRef = useRef(null);

  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTitle, setFileTitle] = useState("");
  const [description, setDescription] = useState("");

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [previewItem, setPreviewItem] = useState(null);
  const [renameItem, setRenameItem] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });

    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // =====================================
  // FETCH CONTENTS
  // =====================================

  const fetchContents = async () => {
    try {
      setLoading(true);

      const response = await apiFetch(`${API_URL}/api/contents`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to retrieve media");
      }

      setContents(result.data || []);
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents();
  }, []);

  // =====================================
  // SELECT FILE
  // =====================================

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      showNotification(
        "Format tidak didukung. Gunakan JPG, PNG, WEBP, MP4, atau PDF.",
        "error"
      );
      event.target.value = "";
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showNotification("Ukuran file maksimal 50 MB.", "error");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setFileTitle(file.name);
  };

  // =====================================
  // UPLOAD FILE
  // =====================================

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      showNotification("Pilih file terlebih dahulu.", "error");
      return;
    }

    if (!fileTitle.trim()) {
      showNotification("Nama file wajib diisi.", "error");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("judul", fileTitle.trim());
      formData.append("description", description.trim());

      const response = await apiFetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Upload failed");
      }

      setSelectedFile(null);
      setFileTitle("");
      setDescription("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchContents();
      showNotification("Media berhasil diunggah.");
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  // =====================================
  // RENAME CONTENT
  // =====================================

  const openRenameModal = (item) => {
    setRenameItem(item);
    setRenameValue(item.judul || "");
  };

  const handleRename = async (event) => {
    event.preventDefault();

    if (!renameValue.trim()) {
      showNotification("Nama media tidak boleh kosong.", "error");
      return;
    }

    try {
      const response = await apiFetch(
        `${API_URL}/api/contents/${renameItem.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            judul: renameValue.trim(),
            tipe: renameItem.tipe,
            payload: renameItem.payload || {},
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to rename media");
      }

      setRenameItem(null);
      setRenameValue("");

      await fetchContents();
      showNotification("Nama media berhasil diperbarui.");
    } catch (error) {
      showNotification(error.message, "error");
    }
  };

  // =====================================
  // DELETE CONTENT
  // =====================================

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus "${item.judul}"?`
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(
        `${API_URL}/api/contents/${item.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete media");
      }

      setContents((previous) =>
        previous.filter((content) => content.id !== item.id)
      );

      if (previewItem?.id === item.id) {
        setPreviewItem(null);
      }

      showNotification("Media berhasil dihapus.");
    } catch (error) {
      showNotification(error.message, "error");
    }
  };

  // =====================================
  // FILTER & SEARCH
  // =====================================

  const filteredContents = useMemo(() => {
    return contents.filter((item) => {
      const type = getMediaType(item);

      const matchesSearch = (item.judul || "")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        activeFilter === "all" || type === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [contents, search, activeFilter]);

  const totalSize = contents.reduce(
    (total, item) => total + Number(item.payload?.size || 0),
    0
  );

  const imageCount = contents.filter(
    (item) => getMediaType(item) === "image"
  ).length;

  const videoCount = contents.filter(
    (item) => getMediaType(item) === "video"
  ).length;

  // =====================================
  // MEDIA CARD
  // =====================================

  const MediaCard = ({ item }) => {
    const type = getMediaType(item);
    const url = getMediaUrl(item);

    return (
      <div className="group overflow-hidden rounded-xl border border-white/[0.08] bg-[#19191d] transition duration-200 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-xl hover:shadow-black/20">
        <div
          className="relative flex h-48 cursor-pointer items-center justify-center overflow-hidden bg-[#101014]"
          onClick={() => setPreviewItem(item)}
        >
          {type === "image" && url ? (
            <img
              src={url}
              alt={item.judul}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : type === "video" && url ? (
            <div className="relative flex h-full w-full items-center justify-center">
              <video
                src={url}
                className="h-full w-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="rounded-full bg-black/60 p-4 text-white backdrop-blur-sm">
                  <Film size={26} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-violet-400">
              <div className="rounded-2xl bg-violet-500/10 p-5">
                {getMediaIcon(type, 36)}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {type}
              </span>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              <Eye size={16} />
              Preview
            </span>
          </div>

          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            {getMediaIcon(type, 12)}
            {type}
          </span>

          <div className="absolute right-3 top-3">
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openRenameModal(item);
                }}
                title="Rename media"
                className="rounded-lg border border-white/10 bg-black/60 p-2 text-white opacity-0 backdrop-blur transition hover:bg-violet-600 group-hover:opacity-100"
              >
                <Pencil size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 min-h-[42px]">
            <h3
              className="truncate text-sm font-semibold text-white"
              title={item.judul}
            >
              {item.judul}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {formatSize(item.payload?.size)}
              <span className="mx-2 text-zinc-700">•</span>
              {formatDate(item.created_at)}
            </p>
          </div>

          {item.payload?.description && (
            <p className="mb-3 truncate text-xs text-zinc-500">
              {item.payload.description}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.07] pt-3">
            <button
              type="button"
              onClick={() => setPreviewItem(item)}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-400 transition hover:text-violet-300"
            >
              <Eye size={14} />
              Preview
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openRenameModal(item)}
                title="Rename"
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-violet-500/10 hover:text-violet-400"
              >
                <Pencil size={15} />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(item)}
                title="Delete"
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =====================================
  // MAIN UI
  // =====================================

  return (
    <div className="space-y-6 pb-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-400">
            <FolderOpen size={15} />
            CONTENT MANAGEMENT
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Media Library
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            Manage and organize your digital signage media files.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchContents}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#19191d] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-violet-500/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total Media
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {contents.length}
              </h2>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
              <FolderOpen size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Files stored in your library
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Images
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {imageCount}
              </h2>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
              <ImageIcon size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Image files available
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Videos
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {videoCount}
              </h2>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <Video size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Video files available
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Storage Used
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {formatSize(totalSize)}
              </h2>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
              <HardDrive size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Total uploaded file size
          </p>
        </div>
      </div>

      {/* UPLOAD SECTION */}
      <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
            <CloudUpload size={22} />
          </div>
          <div>
            <h2 className="font-semibold text-white">Upload New Media</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Add images, videos, or PDF files to your media library.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">
                Media Name
              </label>
              <input
                type="text"
                value={fileTitle}
                onChange={(event) => setFileTitle(event.target.value)}
                placeholder="Enter media name"
                className="w-full rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">
                Description
                <span className="ml-1 text-zinc-600">(Optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Enter media description"
                className="w-full rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-400">
              Select File
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
              onChange={handleFileSelect}
              className="block w-full cursor-pointer rounded-lg border border-white/10 bg-[#111113] text-sm text-zinc-400 file:mr-4 file:cursor-pointer file:border-0 file:bg-violet-600 file:px-5 file:py-3 file:font-medium file:text-white hover:file:bg-violet-500"
            />

            <p className="mt-2 text-xs text-zinc-600">
              JPG, PNG, WEBP, MP4, PDF · Maximum file size 50 MB
            </p>
          </div>

          {selectedFile && (
            <div className="flex flex-col justify-between gap-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400">
                  {getMediaIcon(
                    selectedFile.type.startsWith("image/")
                      ? "image"
                      : selectedFile.type.startsWith("video/")
                        ? "video"
                        : "pdf"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {fileTitle || selectedFile.name}
                    </p>
                  <p className="text-xs text-zinc-500">
                    {formatSize(selectedFile.size)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileTitle("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="self-start rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white sm:self-auto"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload Media
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MEDIA LIBRARY */}
      <div className="rounded-xl border border-white/[0.08] bg-[#19191d] p-5 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-semibold text-white">Uploaded Media</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Browse and manage your uploaded files.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search media..."
                className="w-full rounded-lg border border-white/10 bg-[#111113] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500 sm:w-56"
              />
            </div>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#111113] px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-violet-500"
            >
              <option value="all">All Media</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="pdf">PDF Documents</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-zinc-500">
            <LoaderCircle size={28} className="animate-spin text-violet-400" />
            <p className="text-sm">Loading media library...</p>
          </div>
        ) : filteredContents.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#111113]/50 px-5 text-center">
            <div className="mb-4 rounded-2xl bg-violet-500/10 p-4 text-violet-400">
              <FolderOpen size={30} />
            </div>
            <h3 className="font-semibold text-white">
              {search || activeFilter !== "all"
                ? "No matching media"
                : "Your media library is empty"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              {search || activeFilter !== "all"
                ? "Try changing your search keyword or media filter."
                : "Upload your first image, video, or PDF to get started."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-xs text-zinc-500">
              Showing {filteredContents.length} of {contents.length} media files
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredContents.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* RENAME MODAL */}
      {renameItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRename}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1b1b20] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Rename Media
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Change the display name of this media.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <label className="mb-2 block text-xs font-medium text-zinc-400">
              Media Name
            </label>

            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#19191d] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                  {previewItem.judul}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                  {getMediaType(previewItem)}
                  <span className="mx-2">•</span>
                  {formatSize(previewItem.payload?.size)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="ml-3 rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#101014] p-3 sm:p-6">
              {getMediaType(previewItem) === "image" ? (
                <img
                  src={getMediaUrl(previewItem)}
                  alt={previewItem.judul}
                  className="max-h-[65vh] max-w-full rounded-lg object-contain"
                />
              ) : getMediaType(previewItem) === "video" ? (
                <video
                  src={getMediaUrl(previewItem)}
                  controls
                  autoPlay
                  className="max-h-[65vh] max-w-full rounded-lg"
                />
              ) : getMediaType(previewItem) === "pdf" ? (
                <iframe
                  src={getMediaUrl(previewItem)}
                  title={previewItem.judul}
                  className="h-[65vh] w-full rounded-lg bg-white"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-zinc-400">
                  {getMediaIcon(getMediaType(previewItem), 48)}
                  <p className="text-sm">Preview is not available.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-300">
                  {previewItem.payload?.description || "No description available"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Uploaded: {formatDate(previewItem.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewItem(null);
                    openRenameModal(previewItem);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
                >
                  <Pencil size={15} />
                  Rename
                </button>

                <a
                  href={getMediaUrl(previewItem)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  <ExternalLink size={15} />
                  Open Original
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-[120] flex max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-[#222228] px-4 py-3 shadow-2xl">
          {notification.type === "success" ? (
            <CheckCircle2 size={19} className="shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle size={19} className="shrink-0 text-red-400" />
          )}

          <p className="text-sm text-white">{notification.message}</p>

          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-2 text-zinc-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default MediaLibrary;
