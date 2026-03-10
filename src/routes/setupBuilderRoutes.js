// routes/setupBuilderRoutes.js
import express from "express";
import {
  buildSetup,
  getTemplates,
} from "../controllers/setupBuilderController.js";

const router = express.Router();

router.get("/", getTemplates); // GET  /api/ai/setup-builder  — template list
router.post("/", buildSetup); // POST /api/ai/setup-builder  — generate bundle

// Debug — hit GET /api/ai/setup-builder/debug to check product + embedding counts
router.get("/debug", async (req, res) => {
  try {
    const Product = (await import("../models/product.js")).default;
    const total = await Product.countDocuments({});
    const withEmbed = await Product.countDocuments({
      embedding: { $exists: true, $ne: null },
    });
    const sample = await Product.find(
      { embedding: { $exists: true } },
      { name: 1, _id: 1 },
    ).limit(20);
    res.json({ total, withEmbedding: withEmbed, sample });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
