
import { supabase } from "../config/supabase.js";

// =====================================
// GET ALL DEVICES
// =====================================

export const getDevices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("devices")
      .select("id, nama, lokasi, status, last_seen, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Devices retrieved successfully",
      data: data || [],
    });
  } catch (error) {
    console.error("Get devices error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve devices",
      error: error.message,
    });
  }
};

// =====================================
// CREATE DEVICE
// =====================================

export const createDevice = async (req, res) => {
  try {
    const { nama, lokasi } = req.body || {};

    if (
      typeof nama !== "string" ||
      typeof lokasi !== "string" ||
      !nama.trim() ||
      !lokasi.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Device name and location are required.",
      });
    }

    const { data, error } = await supabase
      .from("devices")
      .insert({
        nama: nama.trim(),
        lokasi: lokasi.trim(),
      })
      .select("id, nama, lokasi, status, last_seen, created_at")
      .single();

    if (error) {
      console.error("Supabase insert device error:", error);

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Device created successfully.",
      data,
    });
  } catch (error) {
    console.error("Create device error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while creating device.",
    });
  }
};

// =====================================
// UPDATE DEVICE
// =====================================

export const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, lokasi } = req.body || {};

    if (
      typeof nama !== "string" ||
      typeof lokasi !== "string" ||
      !nama.trim() ||
      !lokasi.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Nama and lokasi are required.",
      });
    }

    const { data, error } = await supabase
      .from("devices")
      .update({
        nama: nama.trim(),
        lokasi: lokasi.trim(),
      })
      .eq("id", id)
      .select("id, nama, lokasi, status, last_seen, created_at")
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Device updated successfully.",
      data,
    });
  } catch (error) {
    console.error("Update device error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update device",
      error: error.message,
    });
  }
};

// =====================================
// DELETE DEVICE
// =====================================

export const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("devices")
      .delete()
      .eq("id", id)
      .select("id, nama, lokasi, status, last_seen, created_at")
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Device deleted successfully.",
      data,
    });
  } catch (error) {
    console.error("Delete device error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete device",
      error: error.message,
    });
  }
};
