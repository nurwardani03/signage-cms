
import express from "express";
import { upload } from "../middlewares/upload.js";
import { uploadContent } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/", upload.single("file"), uploadContent);

export default router;
