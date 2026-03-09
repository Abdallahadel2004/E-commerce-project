// routes/chatRoutes.js
import express from "express";
import { chat } from "../controllers/chatController.js";

const router = express.Router();

// Public — no auth required, customers don't need to be logged in to use the chatbot
router.post("/", chat);

export default router;
