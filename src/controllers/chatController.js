// controllers/chatController.js
// ─────────────────────────────────────────────────────────────────────────────
// Multi-stage retrieval pipeline:
//   1. Intent Analysis (LLM)     → understand query type + price filters
//   2. Query Preprocessing       → clean + expand with synonyms
//   3. Abstract Query Detection  → vague terms → top-rated fallback
//   4. Vector Search             → semantic similarity (threshold: 0.70)
//   5. Hybrid Keyword Search     → if vector < 2 results
//   6. Fallback Recommendation   → top-rated products if all else fails
//   7. Hallucination Prevention  → LLM only sees DB-sourced products
//   8. Structured JSON response
// ─────────────────────────────────────────────────────────────────────────────

import Product from "../models/product.js";
import { generateEmbedding } from "../services/embeddingService.js";
import { generateChatResponse } from "../services/llmService.js";
import { analyzeIntent, getThreshold } from "../services/intentService.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const VECTOR_THRESHOLD = 0.7;
const VECTOR_CANDIDATES = 400;
const VECTOR_LIMIT = 20;
const HYBRID_TRIGGER = 2; // run keyword search if vector returns < 2
const MAX_RESULTS = 5;

// ── Stop words for query cleaning ─────────────────────────────────────────────
const STOP_WORDS =
  /\b(show|me|find|i|need|want|looking|for|a|an|the|some|any|give|get|please|can|you|what|are|is|have|do|does|how|many|under|below|over|above|less|than|more|around|budget|something|anything|stuff|things|products|items|want|like|id|love)\b/gi;

// ── Abstract / vague query patterns ───────────────────────────────────────────
// These queries have no specific product in mind → return top-rated instead
const ABSTRACT_PATTERNS = [
  /^(fun|cool|nice|great|awesome|interesting|good|useful)$/i,
  /\b(popular|trending|best[\s-]?selling|top[\s-]?rated|most[\s-]?liked|recommended|best)\b/i,
  /^(something|anything)\s*(fun|cool|nice|good|useful|interesting)?$/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Clean and normalize user message for keyword search */
const preprocessQuery = (message) =>
  message
    .toLowerCase()
    .replace(STOP_WORDS, " ")
    .replace(/[^\w\s]/g, " ") // remove punctuation
    .replace(/\s+/g, " ")
    .trim();

/** True if the query is too vague for semantic search */
const isAbstractQuery = (message) =>
  ABSTRACT_PATTERNS.some((p) => p.test(message.trim()));

/** Format products for response payload */
const formatProduct = (p) => ({
  _id: p._id,
  name: p.name,
  price: p.price,
  shortDescription: p.shortDescription || "",
  image: p.images?.[0]?.url || null,
  inStock: (p.inventory?.quantity || 0) > 0,
  rating: p.ratings?.average || 0,
});

/** Shared product field projection */
const PRODUCT_FIELDS = {
  name: 1,
  price: 1,
  shortDescription: 1,
  description: 1,
  images: { $slice: ["$images", 1] },
  inventory: 1,
  ratings: 1,
  isActive: 1,
  deletedAt: 1,
};

/** Active product filter — handles missing isActive field on seeded docs */
const activeFilter = (extra = {}) => ({
  isActive: { $ne: false },
  deletedAt: null,
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
// RETRIEVAL STAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage A: Abstract query → top-rated products
 * Used when user says "popular", "best", "trending", "something fun" etc.
 */
const getTopRatedProducts = async (priceFilter = {}, limit = MAX_RESULTS) => {
  const filter = activeFilter(
    Object.keys(priceFilter).length ? { price: priceFilter } : {},
  );
  return Product.find(filter)
    .select("name price shortDescription description images inventory ratings")
    .sort({ "ratings.average": -1, "ratings.count": -1, soldCount: -1 })
    .limit(limit);
};

/**
 * Stage B: Vector search — semantic similarity using embeddings
 * Returns products above VECTOR_THRESHOLD sorted by cosine similarity score.
 */
const vectorSearch = async (
  embedding,
  priceFilter = {},
  threshold = VECTOR_THRESHOLD,
) => {
  const matchStage = {
    score: { $gte: threshold },
    isActive: { $ne: false },
    deletedAt: null,
  };
  if (Object.keys(priceFilter).length) matchStage.price = priceFilter;

  return Product.aggregate([
    {
      $vectorSearch: {
        index: "product_vector_index",
        path: "embedding",
        queryVector: embedding,
        numCandidates: VECTOR_CANDIDATES,
        limit: VECTOR_LIMIT,
      },
    },
    {
      $project: {
        ...PRODUCT_FIELDS,
        score: { $meta: "vectorSearchScore" },
      },
    },
    { $match: matchStage },
    { $limit: MAX_RESULTS },
  ]);
};

/**
 * Stage C: Hybrid keyword search — regex + optional MongoDB text search
 * Runs when vector search returns fewer than HYBRID_TRIGGER results.
 * Searches across name, description, shortDescription.
 */
const keywordSearch = async (
  cleanedQuery,
  priceFilter = {},
  limit = MAX_RESULTS,
) => {
  if (!cleanedQuery || cleanedQuery.length < 2) return [];

  const regexTerms = cleanedQuery
    .split(" ")
    .filter((w) => w.length > 2)
    .map((w) => `(?=.*${w})`)
    .join("");

  const regex = new RegExp(regexTerms, "i");

  const filter = activeFilter({
    $or: [{ name: regex }, { description: regex }, { shortDescription: regex }],
    ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
  });

  return Product.find(filter)
    .select("name price shortDescription description images inventory ratings")
    .sort({ "ratings.average": -1 })
    .limit(limit);
};

/**
 * Stage D: Fallback — top-rated products with optional price filter
 * Last resort when all other retrieval methods return nothing.
 */
const fallbackRecommendations = async (priceFilter = {}) => {
  console.log("🔄 Using fallback: top-rated products");
  return getTopRatedProducts(priceFilter, MAX_RESULTS);
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

export const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message is required." });
    }
    if (message.trim().length > 500) {
      return res
        .status(400)
        .json({ success: false, message: "Message too long (max 500 chars)." });
    }

    const trimmed = message.trim();
    const startTime = Date.now();

    // ── Step 1: Total product count (for LLM context) ───────────────────────
    const totalProducts = await Product.countDocuments(activeFilter());

    // ── Step 2: LLM Intent Analysis ─────────────────────────────────────────
    // Extracts: isProductSearch, expandedQuery, specificity, priceFilter
    const intent = await analyzeIntent(trimmed, history);

    // ── Step 3: General conversation → skip all product retrieval ───────────
    if (!intent.isProductSearch) {
      console.log(`💬 General conversation (${Date.now() - startTime}ms)`);
      const reply = await generateChatResponse(
        trimmed,
        [],
        history,
        totalProducts,
      );
      return res.json({ success: true, reply, products: [] });
    }

    // ── Step 4: Build price filter for MongoDB ───────────────────────────────
    const priceFilter = {};
    if (
      intent.priceFilter?.min !== null &&
      intent.priceFilter?.min !== undefined
    )
      priceFilter.$gte = intent.priceFilter.min;
    if (
      intent.priceFilter?.max !== null &&
      intent.priceFilter?.max !== undefined
    )
      priceFilter.$lte = intent.priceFilter.max;

    // ── Step 5: Clean query for keyword search ───────────────────────────────
    const cleanedQuery = preprocessQuery(intent.expandedQuery || trimmed);
    console.log(`🔍 Cleaned query: "${cleanedQuery}"`);

    // ── Step 6: Abstract query detection → top-rated shortcut ───────────────
    if (isAbstractQuery(trimmed)) {
      console.log(`⭐ Abstract query detected — returning top-rated products`);
      const products = await getTopRatedProducts(priceFilter);
      if (products.length > 0) {
        const reply = await generateChatResponse(
          trimmed,
          products,
          history,
          totalProducts,
        );
        return res.json({
          success: true,
          reply,
          products: products.map(formatProduct),
        });
      }
    }

    // ── Step 7: Embed the expanded query ────────────────────────────────────
    let queryEmbedding = null;
    try {
      queryEmbedding = await generateEmbedding(intent.expandedQuery || trimmed);
    } catch (err) {
      console.error("⚠️  Embedding failed:", err.message);
    }

    // ── Step 8: Vector search ────────────────────────────────────────────────
    let products = [];
    let retrievalMethod = "none";

    if (queryEmbedding) {
      try {
        const threshold = getThreshold(intent.specificity);
        products = await vectorSearch(queryEmbedding, priceFilter, threshold);

        console.log(
          `🧲 Vector search: ${products.length} results | threshold: ${threshold.toFixed(2)} | scores: ${products.map((p) => p.score?.toFixed(3)).join(", ")}`,
        );

        if (products.length > 0) retrievalMethod = "vector";
      } catch (vectorErr) {
        console.error("⚠️  Vector search failed:", vectorErr.message);
      }
    }

    // ── Step 9: Hybrid keyword search (if vector returned < HYBRID_TRIGGER) ──
    if (products.length < HYBRID_TRIGGER && cleanedQuery.length > 1) {
      console.log(
        `🔤 Hybrid keyword search triggered (vector returned ${products.length})`,
      );

      try {
        const keywordResults = await keywordSearch(cleanedQuery, priceFilter);
        console.log(`🔤 Keyword search: ${keywordResults.length} results`);

        // Merge: keyword results first, then add any unique vector results
        const vectorIds = new Set(products.map((p) => p._id.toString()));
        const merged = [
          ...keywordResults,
          ...products.filter((p) => !vectorIds.has(p._id.toString())),
        ].slice(0, MAX_RESULTS);

        if (merged.length > products.length) {
          products = merged;
          retrievalMethod = products.length > 0 ? "hybrid" : "none";
        }
      } catch (keywordErr) {
        console.error("⚠️  Keyword search failed:", keywordErr.message);
      }
    }

    // ── Step 10: Fallback — top-rated products ───────────────────────────────
    if (products.length === 0) {
      products = await fallbackRecommendations(priceFilter);
      retrievalMethod = products.length > 0 ? "fallback" : "none";
    }

    console.log(
      `✅ Retrieval: ${retrievalMethod} | ${products.length} products | ${Date.now() - startTime}ms`,
    );

    // ── Step 11: Hallucination prevention — no products = no LLM call ────────
    if (products.length === 0) {
      const priceHint = priceFilter.$lte
        ? ` under $${priceFilter.$lte}`
        : priceFilter.$gte
          ? ` above $${priceFilter.$gte}`
          : "";
      return res.json({
        success: true,
        reply: `I couldn't find any products related to your request${priceHint}. We have ${totalProducts} products in total — try using different keywords or ask about a specific category.`,
        products: [],
      });
    }

    // ── Step 12: Generate LLM response using only DB-sourced products ─────────
    // Pass retrieval method so LLM knows whether results are exact or fallback
    const reply = await generateChatResponse(
      trimmed,
      products,
      history,
      totalProducts,
      retrievalMethod,
    );

    return res.json({
      success: true,
      reply,
      products: products.map(formatProduct),
    });
  } catch (error) {
    console.error("❌ Chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};
