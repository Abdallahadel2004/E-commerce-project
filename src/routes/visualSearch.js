// routes/visualSearch.js
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";

import {
  visualSearch,
  listCategories,
  healthCheck,
} from "../controllers/visualSearchController.js";

const router = express.Router();

// ─── Rate limiting ─────────────────────────────────────────────────────────
const searchLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { success: false, error: "Too many search requests. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Multer — memory storage, image-only, 10MB max ────────────────────────
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);
const ALLOWED_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_TYPES.has(file.mimetype) || !ALLOWED_EXTS.has(ext)) {
      return cb(
        Object.assign(
          new Error("Unsupported image type. Use JPEG, PNG, or WebP."),
          {
            status: 400,
          },
        ),
      );
    }
    cb(null, true);
  },
});

/** Validate magic bytes + ensure file was uploaded */
const validateImage = (req, res, next) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, error: "No image file provided." });
  }
  const buf = req.file.buffer;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49;
  const isGif = buf[0] === 0x47 && buf[1] === 0x49;
  if (!isJpeg && !isPng && !isWebp && !isGif) {
    return res.status(400).json({
      success: false,
      error: "File content is not a valid image.",
    });
  }
  next();
};

// ─── Multer error handler ──────────────────────────────────────────────────
const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError || err.status === 400) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
};

// ─── Routes ────────────────────────────────────────────────────────────────
router.get("/health", healthCheck);
router.get("/categories", listCategories);

router.post(
  "/",
  searchLimiter,
  upload.single("image"),
  handleMulterError,
  validateImage,
  visualSearch,
);

// Route-level error handler
router.use((err, _req, res, _next) => {
  console.error("[VisualSearchRoute]", err.message);
  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

export default router;
