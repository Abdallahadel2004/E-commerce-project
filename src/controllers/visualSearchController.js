// controllers/visualSearchController.js
// Flow: uploaded image → Groq Vision → text description → HuggingFace 384-dim embedding
//       → Atlas vector search on `embedding` field (product_vector_index)
//
// Searches the SAME field and index as the chatbot.
// No imageEmbedding field, no batch scripts, no extra Atlas index needed.

import {
  imageToEmbedding,
  getEmbeddingCacheStats,
} from "../services/imageEmbeddingService.js";
import {
  hybridVisualSearch,
  getProductCategories,
} from "../services/visualSearchService.js";

const ok = (res, data, code = 200) =>
  res.status(code).json({ success: true, ...data });
const fail = (res, error, code = 400) =>
  res.status(code).json({ success: false, error });

const formatProduct = (p) => ({
  _id: p._id,
  name: p.name,
  price: p.price,
  shortDescription: p.shortDescription || "",
  image: p.images?.[0]?.url || null,
  inStock: (p.inventory?.quantity || 0) > 0,
  rating: p.ratings?.average || 0,
  similarityScore: p.similarityScore,
});

// ─── POST /api/visual-search ──────────────────────────────────────────────────
// Multipart form fields:
//   image      File     required
//   keyword    string   optional — adds keyword hybrid boost
//   categories string   optional — comma-separated category filter
//   minPrice   number   optional
//   maxPrice   number   optional
//   limit      number   optional (default 10, max 50)
//   minScore   number   optional (default 0.20)
export const visualSearch = async (req, res, next) => {
  try {
    if (!req.file) return fail(res, "No image uploaded", 400);

    const t0 = Date.now();

    const keyword = req.body.keyword?.trim() || null;

    const categories = req.body.categories
      ? (Array.isArray(req.body.categories)
          ? req.body.categories
          : req.body.categories.split(",").map((c) => c.trim())
        ).filter(Boolean)
      : undefined;

    const options = {
      limit: Math.min(parseInt(req.body.limit ?? "10") || 10, 50),
      minScore: parseFloat(req.body.minScore ?? "0.20") || 0.2,
      categories,
      minPrice: req.body.minPrice ? parseFloat(req.body.minPrice) : undefined,
      maxPrice: req.body.maxPrice ? parseFloat(req.body.maxPrice) : undefined,
    };

    console.log("[VisualSearch] Analyzing image with Groq Vision…");

    // imageToEmbedding now returns { embedding, keywords } so the Groq-extracted
    // keywords are available as a hybrid-search fallback when vector scores are low
    const {
      embedding,
      type: imageType,
      keywords: imageKeywords,
    } = await imageToEmbedding(req.file.buffer);

    const products = await hybridVisualSearch(embedding, keyword, {
      ...options,
      imageType, // strict keyword fallback — Groq TYPE e.g. "Digital Camera"
      imageKeywords, // broad keyword fallback — used only when TYPE yields nothing
    });

    const elapsed = Date.now() - t0;

    console.log(`[VisualSearch] ${products.length} results in ${elapsed}ms`);

    return ok(res, {
      count: products.length,
      searchTimeMs: elapsed,
      products: products.map(formatProduct),
    });
  } catch (err) {
    console.error("[VisualSearch]", err.message);
    next(err);
  }
};

// ─── GET /api/visual-search/categories ───────────────────────────────────────
export const listCategories = async (req, res, next) => {
  try {
    return ok(res, { categories: await getProductCategories() });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/visual-search/health ───────────────────────────────────────────
export const healthCheck = (_req, res) =>
  ok(res, {
    status: "healthy",
    cache: getEmbeddingCacheStats(),
    timestamp: new Date().toISOString(),
  });
