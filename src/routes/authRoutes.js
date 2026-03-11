import express from "express";
import { auth } from "../middleware/auth.middleware.js";
import {
  signup,
  signin,
  verifyEmail,
  forgotPassword,
  resetPasswordViaToken,
  resetPassword,
  forgotPassword,
  resetPasswordByToken,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.get("/verify-email/:token", verifyEmail);

// Forgot password — sends reset email
router.post("/forgot-password", forgotPassword);

// Reset password via token from email link (no auth required)
router.post("/reset-password/:id/:token", resetPasswordViaToken);

// Reset password for logged-in user (requires auth)
router.put("/reset-password", auth, resetPassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPasswordByToken);

export default router;
