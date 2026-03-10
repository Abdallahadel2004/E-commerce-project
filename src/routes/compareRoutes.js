// routes/compareRoutes.js
import express from "express";
import {
  getCompareProducts,
  askAboutProducts,
} from "../controllers/compareController.js";

const router = express.Router();

router.get("/", getCompareProducts); // GET  /api/compare?ids=id1,id2,id3
router.post("/ask", askAboutProducts); // POST /api/compare/ask

export default router;
