
import express from "express";

import {
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
} from "../controllers/deviceController.js";

import { supabase } from "../config/supabase.js";
import { authenticateAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// =====================================
// PUBLIC - DEVICE CLIENT
// =====================================

router.get("/public", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("devices")
      .select("id, nama, lokasi")
      .order("nama", { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("Get public devices error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load devices.",
    });
  }
});

// =====================================
// ADMIN - JWT AUTHENTICATION
// =====================================

router.use(authenticateAdmin);

// GET - Menampilkan semua device
router.get("/", getDevices);

// POST - Menambahkan device
router.post("/", createDevice);

// PUT - Mengubah device
router.put("/:id", updateDevice);

// DELETE - Menghapus device
router.delete("/:id", deleteDevice);

export default router;
