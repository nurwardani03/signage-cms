import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { supabase } from "./config/supabase.js";

import deviceRoutes from "./routes/deviceRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { authenticateAdmin } from "./middlewares/authMiddleware.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// =====================================
// SOCKET.IO AUTHENTICATION
// =====================================

// Device clients boleh terkoneksi tanpa JWT.
// Jika token dikirim, token wajib valid.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    socket.data.admin = null;
    return next();
  }

  try {
    if (!process.env.JWT_SECRET) {
      return next(new Error("JWT_SECRET is not configured."));
    }

    socket.data.admin = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new Error("Invalid or expired authentication token."));
  }
});

// =====================================
// IN-MEMORY CONNECTION & SINGLE CONTENT
// =====================================

const deviceConnections = new Map();

// Single content masih menggunakan mekanisme sebelumnya.
const publishedContents = new Map();

const sendAck = (callback, data) => {
  if (typeof callback === "function") callback(data);
};

// =====================================
// DEVICE STATUS
// =====================================

const updateDeviceStatus = async (
  deviceId,
  status,
  updateLastSeen = false,
  broadcast = true
) => {
  const updates = { status };

  if (updateLastSeen) {
    updates.last_seen = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("devices")
    .update(updates)
    .eq("id", deviceId)
    .select("id, nama, lokasi, status, last_seen")
    .single();

  if (error) throw error;

  if (broadcast) {
    io.emit("devices:status", data);
  }

  return data;
};

// =====================================
// MEDIA HELPER
// =====================================

const getContentWithSignedUrl = async (contentId) => {
  const { data: content, error } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();

  if (error) throw error;
  if (!content) return null;

  let mediaUrl = content.payload?.url || null;

  if (content.payload?.storage_path) {
    const { data: signedData, error: signedError } =
      await supabase.storage
        .from("signage-contents")
        .createSignedUrl(
          content.payload.storage_path,
          60 * 60
        );

    if (signedError) throw signedError;

    mediaUrl = signedData.signedUrl;
  }

  return {
    ...content,
    payload: {
      ...(content.payload || {}),
      url: mediaUrl,
    },
  };
};

// =====================================
// SINGLE CONTENT ASSIGNMENT
// =====================================

const getPublishedContent = async (deviceId) => {
  const contentId = publishedContents.get(deviceId);

  if (!contentId) return null;

  const content = await getContentWithSignedUrl(contentId);

  if (!content) {
    publishedContents.delete(deviceId);
    return null;
  }

  return content;
};

// =====================================
// PLAYLIST DATABASE HELPER
// =====================================

const getAssignedPlaylist = async (deviceId) => {
  const { data: assignment, error } = await supabase
    .from("device_playlist_assignments")
    .select("playlist_id")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) throw error;
  if (!assignment) return null;

  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("*")
    .eq("id", assignment.playlist_id)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) return null;

  const items = Array.isArray(playlist.items)
    ? [...playlist.items].sort(
        (a, b) => Number(a.order || 0) - Number(b.order || 0)
      )
    : [];

  const mediaItems = [];

  for (const item of items) {
    const content = await getContentWithSignedUrl(item.contentId);

    if (!content) continue;

    mediaItems.push({
      ...content,
      duration: Math.max(1, Number(item.duration) || 10),
      order: Number(item.order) || mediaItems.length + 1,
    });
  }

  return {
    id: playlist.id,
    nama: playlist.nama,
    deskripsi: playlist.deskripsi || "",
    items: mediaItems,
    created_at: playlist.created_at,
    updated_at: playlist.updated_at,
  };
};

// =====================================
// SOCKET.IO
// =====================================

io.on("connection", (socket) => {
  // Semua event admin wajib berasal dari socket dengan JWT valid.
  // Event device tetap dapat digunakan oleh device client tanpa login.
  socket.use(([event], next) => {
    if (typeof event === "string" && event.startsWith("admin:") && !socket.data.admin) {
      return next(new Error("Admin authentication required."));
    }

    return next();
  });

  console.log(`Client connected: ${socket.id}`);

  // -----------------------------------
  // DEVICE REGISTER
  // -----------------------------------

  socket.on("device:register", async (payload = {}, callback) => {
    try {
      const { deviceId } = payload;

      if (!deviceId) {
        return sendAck(callback, {
          success: false,
          message: "Device ID is required.",
        });
      }

      if (socket.data.deviceId) {
        return sendAck(callback, {
          success: false,
          message: "This socket has already registered a device.",
        });
      }

      const { data: device, error } = await supabase
        .from("devices")
        .select("id, nama, lokasi")
        .eq("id", deviceId)
        .maybeSingle();

      if (error) throw error;

      if (!device) {
        return sendAck(callback, {
          success: false,
          message: "Device not found.",
        });
      }

      socket.data.deviceId = deviceId;

      await socket.join(`device:${deviceId}`);

      if (!deviceConnections.has(deviceId)) {
        deviceConnections.set(deviceId, new Set());
      }

      deviceConnections.get(deviceId).add(socket.id);

      const updatedDevice = await updateDeviceStatus(
        deviceId,
        "online",
        true
      );

      sendAck(callback, {
        success: true,
        message: "Device registered successfully.",
        data: updatedDevice,
      });

      // Playlist diprioritaskan jika device memiliki assignment.
      const currentPlaylist = await getAssignedPlaylist(deviceId);

      if (currentPlaylist) {
        socket.emit("device:playlist", currentPlaylist);
      } else {
        const currentContent = await getPublishedContent(deviceId);

        if (currentContent) {
          socket.emit("device:content", currentContent);
        }
      }

      console.log(`Device online: ${device.nama}`);
    } catch (error) {
      console.error("Device registration error:", error.message);

      sendAck(callback, {
        success: false,
        message: "Failed to register device.",
        error: error.message,
      });
    }
  });

  // -----------------------------------
  // DEVICE HEARTBEAT
  // -----------------------------------

  socket.on("device:heartbeat", async (callback) => {
    try {
      const deviceId = socket.data.deviceId;

      if (!deviceId) {
        return sendAck(callback, {
          success: false,
          message: "Device has not registered.",
        });
      }

      const connections = deviceConnections.get(deviceId);

      if (!connections?.has(socket.id)) {
        return sendAck(callback, {
          success: false,
          message: "Device connection is not active.",
        });
      }

      const updatedDevice = await updateDeviceStatus(
        deviceId,
        "online",
        true
      );

      sendAck(callback, {
        success: true,
        message: "Heartbeat received.",
        last_seen: updatedDevice.last_seen,
      });
    } catch (error) {
      console.error("Heartbeat error:", error.message);

      sendAck(callback, {
        success: false,
        message: "Heartbeat failed.",
        error: error.message,
      });
    }
  });

  // -----------------------------------
  // ADMIN: GET CURRENT CONTENT
  // -----------------------------------

  socket.on(
    "admin:get-current-content",
    async (payload = {}, callback) => {
      try {
        const { deviceId } = payload;

        if (!deviceId) {
          return sendAck(callback, {
            success: false,
            message: "Device ID is required.",
          });
        }

        const { data: device, error } = await supabase
          .from("devices")
          .select("id")
          .eq("id", deviceId)
          .maybeSingle();

        if (error) throw error;

        if (!device) {
          return sendAck(callback, {
            success: false,
            message: "Device not found.",
          });
        }

        const playlist = await getAssignedPlaylist(deviceId);
        const content = playlist
          ? null
          : await getPublishedContent(deviceId);

        const isOnline = Boolean(
          deviceConnections.get(deviceId)?.size
        );

        sendAck(callback, {
          success: true,
          data: content,
          playlist,
          pending: Boolean(content || playlist) && !isOnline,
        });
      } catch (error) {
        console.error("Get current content error:", error.message);

        sendAck(callback, {
          success: false,
          message: "Failed to get current content.",
          error: error.message,
        });
      }
    }
  );

  // -----------------------------------
  // ADMIN: REMOTE RECONNECT
  // -----------------------------------

  socket.on("admin:reconnect", async (payload = {}, callback) => {
    try {
      const { deviceId } = payload;

      if (!deviceId) {
        return sendAck(callback, {
          success: false,
          message: "Device ID is required.",
        });
      }

      const { data: device, error } = await supabase
        .from("devices")
        .select("id, nama")
        .eq("id", deviceId)
        .maybeSingle();

      if (error) throw error;

      if (!device) {
        return sendAck(callback, {
          success: false,
          message: "Device not found.",
        });
      }

      const connections = deviceConnections.get(deviceId);

      if (!connections?.size) {
        return sendAck(callback, {
          success: false,
          message: "Device sedang Offline.",
        });
      }

      io.to(`device:${deviceId}`).emit("device:reconnect");

      sendAck(callback, {
        success: true,
        message: `Perintah reconnect berhasil dikirim ke ${device.nama}.`,
        data: { deviceId },
      });
    } catch (error) {
      console.error("Remote reconnect error:", error.message);

      sendAck(callback, {
        success: false,
        message: "Failed to send reconnect command.",
        error: error.message,
      });
    }
  });

  // -----------------------------------
  // ADMIN: PUBLISH SINGLE CONTENT
  // -----------------------------------

  socket.on("admin:publish", async (payload = {}, callback) => {
    try {
      const { deviceId, contentId } = payload;

      if (!deviceId || !contentId) {
        return sendAck(callback, {
          success: false,
          message: "Device ID and Content ID are required.",
        });
      }

      const { data: device, error: deviceError } = await supabase
        .from("devices")
        .select("id, nama")
        .eq("id", deviceId)
        .maybeSingle();

      if (deviceError) throw deviceError;

      if (!device) {
        return sendAck(callback, {
          success: false,
          message: "Device not found.",
        });
      }

      const content = await getContentWithSignedUrl(contentId);

      if (!content) {
        return sendAck(callback, {
          success: false,
          message: "Content not found.",
        });
      }

      // Hapus assignment playlist agar mode single content aktif.
      const { error: assignmentError } = await supabase
        .from("device_playlist_assignments")
        .delete()
        .eq("device_id", deviceId);

      if (assignmentError) throw assignmentError;

      publishedContents.set(deviceId, contentId);

      const isOnline = Boolean(
        deviceConnections.get(deviceId)?.size
      );

      if (isOnline) {
        io.to(`device:${deviceId}`).emit("device:content", content);
      }

      io.emit("devices:content-status", {
        deviceId,
        content,
        playlist: null,
        pending: !isOnline,
      });

      sendAck(callback, {
        success: true,
        pending: !isOnline,
        message: isOnline
          ? `Konten berhasil dikirim ke ${device.nama}.`
          : `Konten berhasil diantrekan untuk ${device.nama}.`,
        data: {
          deviceId,
          contentId,
          judul: content.judul,
          content,
        },
      });
    } catch (error) {
      console.error("Publish error:", error.message);

      sendAck(callback, {
        success: false,
        message: "Failed to publish content.",
        error: error.message,
      });
    }
  });

  // -----------------------------------
  // ADMIN: PUBLISH PLAYLIST
  // -----------------------------------

  socket.on(
    "admin:publish-playlist",
    async (payload = {}, callback) => {
      try {
        const { deviceId, playlistId } = payload;

        if (!deviceId || !playlistId) {
          return sendAck(callback, {
            success: false,
            message: "Device ID and Playlist ID are required.",
          });
        }

        const { data: device, error: deviceError } = await supabase
          .from("devices")
          .select("id, nama")
          .eq("id", deviceId)
          .maybeSingle();

        if (deviceError) throw deviceError;

        if (!device) {
          return sendAck(callback, {
            success: false,
            message: "Device not found.",
          });
        }

        const { data: playlist, error: playlistError } =
          await supabase
            .from("playlists")
            .select("*")
            .eq("id", playlistId)
            .maybeSingle();

        if (playlistError) throw playlistError;

        if (!playlist) {
          return sendAck(callback, {
            success: false,
            message: "Playlist not found.",
          });
        }

        // Validasi isi playlist dan signed URL sebelum assignment.
        const playlistPayload = await getAssignedPlaylistPayload(
          playlist
        );

        if (!playlistPayload.items.length) {
          return sendAck(callback, {
            success: false,
            message: "Playlist tidak memiliki media yang valid.",
          });
        }

        // Assignment disimpan permanen di Supabase.
        const { error: assignmentError } = await supabase
          .from("device_playlist_assignments")
          .upsert(
            {
              device_id: deviceId,
              playlist_id: playlistId,
            },
            { onConflict: "device_id" }
          );

        if (assignmentError) throw assignmentError;

        // Hapus single content assignment dalam memory.
        publishedContents.delete(deviceId);

        const isOnline = Boolean(
          deviceConnections.get(deviceId)?.size
        );

        if (isOnline) {
          io.to(`device:${deviceId}`).emit(
            "device:playlist",
            playlistPayload
          );
        }

        io.emit("devices:content-status", {
          deviceId,
          content: null,
          playlist: playlistPayload,
          pending: !isOnline,
        });

        sendAck(callback, {
          success: true,
          pending: !isOnline,
          message: isOnline
            ? `Playlist berhasil dikirim ke ${device.nama}.`
            : `Playlist berhasil diantrekan untuk ${device.nama}.`,
          data: {
            deviceId,
            playlist: playlistPayload,
          },
        });

        console.log(
          `Playlist "${playlist.nama}" assigned to ${device.nama}`
        );
      } catch (error) {
        console.error("Publish playlist error:", error.message);

        sendAck(callback, {
          success: false,
          message: "Failed to publish playlist.",
          error: error.message,
        });
      }
    }
  );

  // -----------------------------------
  // ADMIN: REMOVE CONTENT / PLAYLIST
  // -----------------------------------

  socket.on(
    "admin:remove-content",
    async (payload = {}, callback) => {
      try {
        const { deviceId } = payload;

        if (!deviceId) {
          return sendAck(callback, {
            success: false,
            message: "Device ID is required.",
          });
        }

        const { data: device, error } = await supabase
          .from("devices")
          .select("id, nama")
          .eq("id", deviceId)
          .maybeSingle();

        if (error) throw error;

        if (!device) {
          return sendAck(callback, {
            success: false,
            message: "Device not found.",
          });
        }

        publishedContents.delete(deviceId);

        const { error: assignmentError } = await supabase
          .from("device_playlist_assignments")
          .delete()
          .eq("device_id", deviceId);

        if (assignmentError) throw assignmentError;

        const isOnline = Boolean(
          deviceConnections.get(deviceId)?.size
        );

        if (isOnline) {
          io.to(`device:${deviceId}`).emit("device:content:clear");
        }

        io.emit("devices:content-status", {
          deviceId,
          content: null,
          playlist: null,
          pending: false,
        });

        sendAck(callback, {
          success: true,
          message: `Assignment konten berhasil dihapus dari ${device.nama}.`,
          data: { deviceId },
        });
      } catch (error) {
        console.error("Remove content error:", error.message);

        sendAck(callback, {
          success: false,
          message: "Failed to remove content.",
          error: error.message,
        });
      }
    }
  );

  // -----------------------------------
  // DEVICE DISCONNECT
  // -----------------------------------

  socket.on("disconnect", async (reason) => {
    const deviceId = socket.data.deviceId;

    if (!deviceId) {
      console.log(`Client disconnected: ${socket.id}`);
      return;
    }

    try {
      const connections = deviceConnections.get(deviceId);

      if (connections) {
        connections.delete(socket.id);

        if (connections.size > 0) {
          return;
        }

        deviceConnections.delete(deviceId);
      }

      const updatedDevice = await updateDeviceStatus(
        deviceId,
        "offline",
        false,
        false
      );

      // Cek apakah device tersambung kembali saat update berlangsung.
      const activeConnections = deviceConnections.get(deviceId);

      if (activeConnections?.size > 0) {
        const correctedDevice = await updateDeviceStatus(
          deviceId,
          "online",
          true,
          true
        );

        console.log(
          `Device connection restored: ${correctedDevice.nama}`
        );

        return;
      }

      io.emit("devices:status", updatedDevice);

      console.log(`Device offline: ${updatedDevice.nama}`);
    } catch (error) {
      console.error("Device disconnect error:", error.message);
    }

    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

// =====================================
// PLAYLIST PAYLOAD HELPER
// =====================================

async function getAssignedPlaylistPayload(playlist) {
  const items = Array.isArray(playlist.items)
    ? [...playlist.items].sort(
        (a, b) => Number(a.order || 0) - Number(b.order || 0)
      )
    : [];

  const mediaItems = [];

  for (const item of items) {
    const content = await getContentWithSignedUrl(item.contentId);

    if (!content) continue;

    mediaItems.push({
      ...content,
      duration: Math.max(1, Number(item.duration) || 10),
      order: Number(item.order) || mediaItems.length + 1,
    });
  }

  return {
    id: playlist.id,
    nama: playlist.nama,
    deskripsi: playlist.deskripsi || "",
    items: mediaItems,
    created_at: playlist.created_at,
    updated_at: playlist.updated_at,
  };
}

// =====================================
// AUTHENTICATION API
// =====================================

// Login endpoint bersifat publik agar admin bisa memperoleh JWT.
app.use("/api/auth", authRoutes);

// =====================================
// PLAYLIST REST API
// =====================================

// Semua endpoint playlist wajib menggunakan JWT admin.
app.use("/api/playlists", authenticateAdmin);

// GET ALL PLAYLISTS
app.get("/api/playlists", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("Get playlists error:", error.message);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data playlist.",
      error: error.message,
    });
  }
});

// GET PLAYLIST BY ID
app.get("/api/playlists/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Playlist tidak ditemukan.",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get playlist error:", error.message);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil playlist.",
      error: error.message,
    });
  }
});

// CREATE PLAYLIST
app.post("/api/playlists", async (req, res) => {
  try {
    const {
      nama,
      deskripsi = "",
      items = [],
    } = req.body;

    if (typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama playlist wajib diisi.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Pilih minimal satu media.",
      });
    }

    const contentIds = items.map((item) => item.contentId);

    if (contentIds.some((id) => !id)) {
      return res.status(400).json({
        success: false,
        message: "Data media tidak valid.",
      });
    }

    if (new Set(contentIds).size !== contentIds.length) {
      return res.status(400).json({
        success: false,
        message: "Media yang sama tidak boleh dipilih dua kali.",
      });
    }

    const { data: contents, error: contentError } = await supabase
      .from("contents")
      .select("id")
      .in("id", contentIds);

    if (contentError) throw contentError;

    if (!contents || contents.length !== contentIds.length) {
      return res.status(400).json({
        success: false,
        message: "Ada media yang tidak ditemukan.",
      });
    }

    const playlistItems = items.map((item, index) => ({
      contentId: item.contentId,
      duration: Math.max(1, Number(item.duration) || 10),
      order: index + 1,
    }));

    const { data: playlist, error } = await supabase
      .from("playlists")
      .insert({
        nama: nama.trim(),
        deskripsi:
          typeof deskripsi === "string" ? deskripsi.trim() : "",
        items: playlistItems,
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Playlist berhasil dibuat.",
      data: playlist,
    });
  } catch (error) {
    console.error("Create playlist error:", error.message);

    res.status(500).json({
      success: false,
      message: "Gagal membuat playlist.",
      error: error.message,
    });
  }
});

// DELETE PLAYLIST
app.delete("/api/playlists/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: playlist, error: findError } = await supabase
      .from("playlists")
      .select("id, nama")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist tidak ditemukan.",
      });
    }

    // Cari device yang sedang menggunakan playlist ini.
    const { data: assignments, error: assignmentError } =
      await supabase
        .from("device_playlist_assignments")
        .select("device_id")
        .eq("playlist_id", id);

    if (assignmentError) throw assignmentError;

    // Bersihkan tampilan device yang sedang online.
    for (const assignment of assignments || []) {
      const { device_id: deviceId } = assignment;

      if (deviceConnections.get(deviceId)?.size) {
        io.to(`device:${deviceId}`).emit("device:content:clear");
      }

      io.emit("devices:content-status", {
        deviceId,
        content: null,
        playlist: null,
        pending: false,
      });
    }

    // Assignment akan ikut terhapus melalui ON DELETE CASCADE.
    const { error: deleteError } = await supabase
      .from("playlists")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: "Playlist berhasil dihapus.",
    });
  } catch (error) {
    console.error("Delete playlist error:", error.message);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus playlist.",
      error: error.message,
    });
  }
});

// EXISTING REST API
// Endpoint /public dapat diakses Device Client.
app.use("/api/devices", deviceRoutes);

// Endpoint lainnya tetap dilindungi JWT.
app.use("/api/contents", authenticateAdmin, contentRoutes);
app.use("/api/upload", authenticateAdmin, uploadRoutes);
// =====================================
// HEALTH CHECK
// =====================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SignageCMS Backend API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is healthy",
    service: "SignageCMS API",
    realtime: "Socket.IO active",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const { error } = await supabase
      .from("devices")
      .select("id")
      .limit(1);

    if (error) throw error;

    // Tes juga kedua tabel playlist.
    const { error: playlistError } = await supabase
      .from("playlists")
      .select("id")
      .limit(1);

    if (playlistError) throw playlistError;

    const { error: assignmentError } = await supabase
      .from("device_playlist_assignments")
      .select("id")
      .limit(1);

    if (assignmentError) throw assignmentError;

    res.json({
      success: true,
      message: "Supabase database connected",
      database: "PostgreSQL",
      tables: [
        "devices",
        "contents",
        "playlists",
        "device_playlist_assignments",
      ],
      connection: "OK",
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// =====================================
// START SERVER
// =====================================

const startServer = async () => {
  try {
    const { error } = await supabase
      .from("devices")
      .update({ status: "offline" })
      .neq("status", "offline");

    if (error) throw error;

    console.log("Device statuses initialized to offline.");
  } catch (error) {
    console.error(
      "Could not initialize device statuses:",
      error.message
    );
  }

  httpServer.listen(PORT, () => {
    console.log("----------------------------------");
    console.log("   SIGNAGECMS BACKEND STARTED");
    console.log("----------------------------------");
    console.log(`Server   : http://localhost:${PORT}`);
    console.log(`Login    : http://localhost:${PORT}/api/auth/login`);
    console.log(`Health   : http://localhost:${PORT}/api/health`);
    console.log(`Devices  : http://localhost:${PORT}/api/devices`);
    console.log(`Contents : http://localhost:${PORT}/api/contents`);
    console.log(`Playlists: http://localhost:${PORT}/api/playlists`);
    console.log(`Upload   : http://localhost:${PORT}/api/upload`);
    console.log("Socket   : Running");
    console.log("Heartbeat: Enabled");
    console.log("----------------------------------");
  });
};

startServer();