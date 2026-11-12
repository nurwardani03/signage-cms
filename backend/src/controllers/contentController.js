
import { supabase } from "../config/supabase.js";

const BUCKET_NAME = "signage-contents";
const SIGNED_URL_EXPIRY = 60 * 60;

// =====================================
// HELPER: GENERATE SIGNED URL
// =====================================

const generateSignedUrl = async (storagePath) => {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error) throw error;

  return data.signedUrl;
};

// =====================================
// GET ALL CONTENTS
// =====================================

export const getContents = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const contentsWithUrl = await Promise.all(
      data.map(async (content) => {
        const storagePath = content.payload?.storage_path;

        if (!storagePath) return content;

        try {
          const url = await generateSignedUrl(storagePath);

          return {
            ...content,
            payload: {
              ...content.payload,
              url,
            },
          };
        } catch (error) {
          console.error("Signed URL error:", error.message);
          return content;
        }
      })
    );

    res.status(200).json({
      success: true,
      message: "Contents retrieved successfully",
      data: contentsWithUrl,
    });
  } catch (error) {
    console.error("Get contents error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve contents",
      error: error.message,
    });
  }
};

// =====================================
// CREATE CONTENT WITHOUT FILE
// =====================================

export const createContent = async (req, res) => {
  try {
    const { judul, tipe, payload } = req.body;

    if (!judul || !tipe) {
      return res.status(400).json({
        success: false,
        message: "Judul and tipe are required",
      });
    }

    const { data, error } = await supabase
      .from("contents")
      .insert([
        {
          judul,
          tipe,
          payload: payload || {},
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Content created successfully",
      data,
    });
  } catch (error) {
    console.error("Create content error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create content",
      error: error.message,
    });
  }
};

// =====================================
// CREATE CONTENT WITH FILE
// =====================================

export const createContentWithFile = async (req, res) => {
  let uploadedPath = null;

  try {
    const { judul, tipe } = req.body;

    if (!judul || !tipe) {
      return res.status(400).json({
        success: false,
        message: "Judul and tipe are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File is required",
      });
    }

    const file = req.file;

    const fileName = `${Date.now()}-${file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

    if (uploadError) throw uploadError;

    uploadedPath = uploadData.path;

    // Generate signed URL
    const url = await generateSignedUrl(uploadedPath);

    // Save metadata to database
    const { data, error } = await supabase
      .from("contents")
      .insert([
        {
          judul,
          tipe,
          payload: {
            storage_path: uploadedPath,
            original_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
          },
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Content uploaded and saved successfully",
      data: {
        ...data,
        payload: {
          ...data.payload,
          url,
        },
      },
    });
  } catch (error) {
    // Cleanup uploaded file if the process fails
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([uploadedPath]);

      if (cleanupError) {
        console.error("Upload cleanup error:", cleanupError.message);
      }
    }

    console.error("Create content with file error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to upload and save content",
      error: error.message,
    });
  }
};

// =====================================
// UPDATE CONTENT
// =====================================

export const updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, tipe, payload } = req.body;

    if (!judul || !tipe) {
      return res.status(400).json({
        success: false,
        message: "Judul and tipe are required",
      });
    }

    // Get existing content to preserve file metadata
    const { data: existingContent, error: fetchError } = await supabase
      .from("contents")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const updatedPayload =
      payload !== undefined
        ? { ...existingContent.payload, ...payload }
        : existingContent.payload;

    const { data, error } = await supabase
      .from("contents")
      .update({
        judul,
        tipe,
        payload: updatedPayload,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Content updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update content error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update content",
      error: error.message,
    });
  }
};

// =====================================
// DELETE CONTENT + STORAGE FILE
// =====================================

export const deleteContent = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find content
    const { data: content, error: fetchError } = await supabase
      .from("contents")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const storagePath = content.payload?.storage_path;

    // 2. Delete physical file from Storage first
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (storageError) throw storageError;
    }

    // 3. Delete database record
    const { error: deleteError } = await supabase
      .from("contents")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      message: "Content and storage file deleted successfully",
      data: {
        id: content.id,
        judul: content.judul,
        fileDeleted: Boolean(storagePath),
      },
    });
  } catch (error) {
    console.error("Delete content error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to delete content",
      error: error.message,
    });
  }
};
