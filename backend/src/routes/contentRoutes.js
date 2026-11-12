
import express from "express";

import {
  getContents,
  createContent,
  createContentWithFile,
  updateContent,
  deleteContent,
} from "../controllers/contentController.js";

import { upload } from "../middlewares/upload.js";

const router = express.Router();

// GET - Menampilkan semua konten
router.get("/", getContents);

// POST - Menambahkan konten tanpa file
router.post("/", createContent);

// POST - Upload file sekaligus menyimpan metadata konten
router.post(
  "/upload",
  upload.single("file"),
  createContentWithFile
);

// PUT - Mengubah konten
router.put("/:id", updateContent);

// DELETE - Menghapus konten dan file Storage
router.delete("/:id", deleteContent);

export default router;
