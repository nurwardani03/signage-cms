
import { useState } from "react";
import { X, Monitor, MapPin, Tag, FileText } from "lucide-react";

const deviceTypes = [
  "Corporate Display",
  "Meeting Display",
  "Information Display",
  "IT Monitoring Display",
  "Product Showcase Display",
  "Training Display",
];

export default function AddDeviceModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    type: "Corporate Display",
    description: "",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.location.trim()) {
      setError("Device name dan location wajib diisi.");
      return;
    }

    const newDevice = {
      id: `DEV-${Date.now().toString().slice(-6)}`,
      name: form.name.trim(),
      location: form.location.trim(),
      type: form.type,
      description: form.description.trim(),
      status: "offline",
      lastSeen: "Never connected",
    };

    onSave(newDevice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c20] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              Add New Device
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Register a new digital signage device.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Device Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Device Name <span className="text-red-400">*</span>
            </label>

            <div className="relative">
              <Monitor
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Example: Lobby Display"
                className="w-full rounded-lg border border-white/10 bg-[#111113] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Location <span className="text-red-400">*</span>
            </label>

            <div className="relative">
              <MapPin
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Example: Lobby / Reception"
                className="w-full rounded-lg border border-white/10 bg-[#111113] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Device Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Device Type
            </label>

            <div className="relative">
              <Tag
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full appearance-none rounded-lg border border-white/10 bg-[#111113] py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-purple-500"
              >
                {deviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Description
            </label>

            <div className="relative">
              <FileText
                size={17}
                className="absolute left-3 top-3 text-zinc-500"
              />

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Additional device information..."
                className="w-full resize-none rounded-lg border border-white/10 bg-[#111113] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              Save Device
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
