// controllers/visualSearchController.js
// ─────────────────────────────────────────────────────────────────────────────
// Visual product search endpoints.
// Uses CLIP image embeddings stored in product.imageEmbedding (512-dim).
// Completely separate from chatController which uses product.embedding (384-dim).
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateImageEmbedding,
  generateImageEmbeddingFromUrl,
  getEmbeddingCacheStats,
} from "../services/imageEmbeddingService.js";
import {
  hybridVisualSearch,
  getProductCategories,
} from "../services/visualSearchService.js";
import Product from "../models/product.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ok = (res, data, code = 200) =>
  res.status(code).json({ success: true, ...data });

const fail = (res, error, code = 400) =>
  res.status(code).json({ success: false, error });

/** Format product for response — matches chatController.formatProduct shape */
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

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/visual-search
 *
 * Multipart/form-data fields:
 *   image       File     required
 *   keyword     string   optional — hybrid visual+text search
 *   categories  string   optional — comma-separated or multiple fields
 *   minPrice    number   optional
 *   maxPrice    number   optional
 *   limit       number   optional (default 10, max 50)
 *   minScore    number   optional (default 0.60)
 */
export const visualSearch = async (req, res, next) => {
  try {
    const t0 = Date.now();
    const imageBuffer = req.file.buffer;

    // ── Parse search options ──────────────────────────────────────────────
    const keyword = req.body.keyword?.trim() || null;

    const categories = req.body.categories
      ? (Array.isArray(req.body.categories)
          ? req.body.categories
          : req.body.categories.split(",").map((c) => c.trim())
        ).filter(Boolean)
      : undefined;

    const options = {
      limit: Math.min(parseInt(req.body.limit ?? "10") || 10, 50),
      minScore: parseFloat(req.body.minScore ?? "0.60") || 0.6,
      categories,
      minPrice: req.body.minPrice ? parseFloat(req.body.minPrice) : undefined,
      maxPrice: req.body.maxPrice ? parseFloat(req.body.maxPrice) : undefined,
    };

    // ── Generate CLIP image embedding ─────────────────────────────────────
    console.log("[VisualSearch] Generating CLIP embedding…");
    const queryEmbedding = await generateImageEmbedding(imageBuffer);

    // ── Run hybrid search ─────────────────────────────────────────────────
    const products = await hybridVisualSearch(queryEmbedding, keyword, options);
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

/**
 * GET /api/visual-search/categories
 */
export const listCategories = async (req, res, next) => {
  try {
    const categories = await getProductCategories();
    return ok(res, { categories });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/visual-search/embed/:productId
 *
 * Generates and saves imageEmbedding for one product.
 * Triggered automatically on product creation or manually.
 * Body (optional): { imageUrl: string }
 */
export const embedProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId).select(
      "+imageEmbedding images name",
    );

    if (!product) return fail(res, "Product not found", 404);

    const imageUrl = req.body.imageUrl || product.images?.[0]?.url;
    if (!imageUrl) return fail(res, "Product has no image URL");

    const embedding = await generateImageEmbeddingFromUrl(imageUrl);

    await Product.findByIdAndUpdate(product._id, {
      imageEmbedding: embedding,
      imageEmbeddingGeneratedAt: new Date(),
    });

    console.log(`[EmbedProduct] ✓ ${product.name} (${embedding.length}-dim)`);

    return ok(res, {
      productId: product._id,
      embeddingDimension: embedding.length,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error("[EmbedProduct]", err.message);
    next(err);
  }
};

/**
 * POST /api/visual-search/embed/batch
 * Background batch embedding for all products missing imageEmbedding.
 * ⚠ Protect with admin auth middleware in production.
 */
export const batchEmbedProducts = async (req, res, next) => {
  try {
    const products = await Product.findWithoutImageEmbedding();

    if (products.length === 0) {
      return ok(res, {
        message: "All products already have image embeddings.",
      });
    }

    // Fire and forget — respond immediately
    runBatch(products).catch((err) =>
      console.error("[BatchEmbed] Fatal:", err.message),
    );

    return ok(res, {
      message: `Image embedding batch started for ${products.length} products.`,
      total: products.length,
    });
  } catch (err) {
    next(err);
  }
};

/** Serial batch processor — respects HuggingFace rate limits */
const runBatch = async (products) => {
  let success = 0;
  let failed = 0;

  for (const product of products) {
    const imageUrl = product.images?.[0]?.url;

    if (!imageUrl) {
      console.warn(`[BatchEmbed] Skipping ${product.name}: no image`);
      failed++;
      continue;
    }

    try {
      const embedding = await generateImageEmbeddingFromUrl(imageUrl);
      await Product.findByIdAndUpdate(product._id, {
        imageEmbedding: embedding,
        imageEmbeddingGeneratedAt: new Date(),
      });
      console.log(
        `[BatchEmbed] ✓ ${product.name} (${++success}/${products.length})`,
      );
      await new Promise((r) => setTimeout(r, 500)); // rate-limit pause
    } catch (err) {
      console.error(`[BatchEmbed] ✗ ${product.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[BatchEmbed] Done — ${success} success, ${failed} failed`);
};

/**
 * GET /api/visual-search/health
 */
export const healthCheck = async (_req, res) => {
  return ok(res, {
    status: "healthy",
    cache: getEmbeddingCacheStats(),
    timestamp: new Date().toISOString(),
  });
};
