
import { supabase } from "../config/supabase.js";

const BUCKET_NAME = "signage-contents";
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7;

export const uploadContent = async (req, res) => {
  let uploadedPath = null;

  try {
    // 1. Validate uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File is required.",
      });
    }

    const file = req.file;

    // 2. Read custom media name from form data
    const judulInput = req.body?.judul;

    const judul =
      typeof judulInput === "string" && judulInput.trim().length > 0
        ? judulInput.trim()
        : file.originalname;

    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim()
        : "";

    // 3. Generate unique storage filename
    const safeOriginalName = file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    );

    const fileName = `${Date.now()}-${safeOriginalName}`;

    // 4. Determine content type
    let tipe = "file";

    if (file.mimetype.startsWith("image/")) {
      tipe = "image";
    } else if (file.mimetype.startsWith("video/")) {
      tipe = "video";
    } else if (file.mimetype === "application/pdf") {
      tipe = "pdf";
    }

    // 5. Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

    if (uploadError) throw uploadError;

    uploadedPath = uploadData.path;

    // 6. Generate signed URL
    const { data: signedData, error: signedError } =
      await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(uploadedPath, SIGNED_URL_EXPIRY);

    if (signedError) throw signedError;

    // 7. Save metadata to database
    const { data: contentData, error: contentError } =
      await supabase
        .from("contents")
        .insert({
          judul,
          tipe,
          payload: {
            storage_path: uploadedPath,
            url: signedData.signedUrl,
            description,
            original_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
          },
        })
        .select()
        .single();

    if (contentError) throw contentError;

    // 8. Return successful response
    return res.status(201).json({
      success: true,
      message: "Media uploaded successfully.",
      data: contentData,
    });

  } catch (error) {
    console.error("Upload error:", error);

    // 9. Rollback uploaded file if database operation fails
    if (uploadedPath) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([uploadedPath]);

      if (removeError) {
        console.error("Storage rollback error:", removeError.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload media.",
      error: error.message,
    });
  }
};
