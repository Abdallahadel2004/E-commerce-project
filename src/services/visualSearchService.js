// services/visualSearchService.js
// Vector search using the existing `embedding` field + `product_vector_index`.
// Same field and index as the chatbot — no extra index or batch script needed.

import Product from "../models/product.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Cross-modal image→text embeddings score lower than text→text by nature;
// 0.25 keeps genuine matches while filtering weak/unrelated results.
const DEFAULT_MIN_SCORE = 0.25;
const CANDIDATES_MULT = 15; // wider candidate pool compensates for modality gap
// Auto-trigger keyword fallback when vector alone returns fewer than this
const SPARSE_VECTOR_THRESHOLD = 3;
// Drop merged results whose combined RRF score falls below this — prevents
// weakly-related keyword-only hits from surfacing in the final list
const RRF_MIN_SCORE = 0.004;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const buildFilter = ({ categories, minPrice, maxPrice } = {}) => {
  const must = [{ isActive: { $ne: false } }, { deletedAt: null }];
  if (categories?.length) must.push({ category: { $in: categories } });
  if (minPrice != null || maxPrice != null) {
    const pf = {};
    if (minPrice != null) pf.$gte = Number(minPrice);
    if (maxPrice != null) pf.$lte = Number(maxPrice);
    must.push({ price: pf });
  }
  return { $and: must };
};

const PROJECTION = {
  _id: 1,
  name: 1,
  shortDescription: 1,
  price: 1,
  compareAtPrice: 1,
  images: { $slice: ["$images", 1] },
  category: 1,
  inventory: 1,
  ratings: 1,
  similarityScore: 1,
};

// ─── Pure vector search ───────────────────────────────────────────────────────
export const vectorSearch = async (queryEmbedding, options = {}) => {
  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const numCandidates = limit * CANDIDATES_MULT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  return Product.aggregate([
    {
      $vectorSearch: {
        index: "product_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates,
        limit: limit * 2,
      },
    },
    { $addFields: { similarityScore: { $meta: "vectorSearchScore" } } },
    {
      $match: { similarityScore: { $gte: minScore }, ...buildFilter(options) },
    },
    { $project: PROJECTION },
    { $sort: { similarityScore: -1 } },
    { $limit: limit },
  ]);
};

// ─── Hybrid search (vector + keyword) ────────────────────────────────────────

/**
 * Combines vector results with keyword results via Reciprocal Rank Fusion.
 *
 * Keyword search is triggered when:
 *   (a) an explicit keyword is provided by the caller, OR
 *   (b) vector alone returns fewer than SPARSE_VECTOR_THRESHOLD results
 *       — in that case imageKeywords (from Groq) is used as the fallback term.
 *
 * @param {number[]} queryEmbedding
 * @param {string|null} keyword        — user-supplied keyword (optional)
 * @param {object}      options
 * @param {string}      options.imageType     — Groq TYPE field, e.g. "Digital Camera"
 * @param {string}      options.imageKeywords — full Groq keyword list, used as
 *                                              broad fallback only when TYPE yields nothing
 */
export const hybridVisualSearch = async (
  queryEmbedding,
  keyword,
  options = {},
) => {
  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const { imageType, imageKeywords, ...searchOptions } = options;

  // Always run vector search first
  const vectorResults = await vectorSearch(queryEmbedding, {
    ...searchOptions,
    limit: limit * 2,
  });

  console.log(`[VisualSearch] Vector: ${vectorResults.length} results`);

  // Determine which keyword string to use:
  //  1. Explicit user keyword (most trusted)
  //  2. Groq TYPE when vector is sparse — strict, single-concept match
  //  3. Groq full keyword list — broadest fallback, only when TYPE also fails
  let activeKeyword = keyword?.trim() || null;
  let fallbackKeywords = null;

  if (!activeKeyword && vectorResults.length < SPARSE_VECTOR_THRESHOLD) {
    activeKeyword = imageType || null; // strict first pass
    fallbackKeywords = imageKeywords || null; // broad second pass if needed
  }

  if (!activeKeyword) return vectorResults.slice(0, limit);

  const source = keyword?.trim()
    ? "user keyword"
    : `image type fallback ("${activeKeyword}")`;
  console.log(`[VisualSearch] Keyword search triggered (${source})`);

  let kwResults = await keywordSearch(activeKeyword, searchOptions);
  console.log(`[VisualSearch] Keyword (strict): ${kwResults.length} results`);

  // If TYPE matched nothing and we have broad keywords, try those as a second pass
  if (!kwResults.length && fallbackKeywords) {
    console.log(
      `[VisualSearch] Keyword (broad fallback): "${fallbackKeywords}"`,
    );
    kwResults = await keywordSearch(fallbackKeywords, searchOptions);
    console.log(`[VisualSearch] Keyword (broad): ${kwResults.length} results`);
  }

  if (!kwResults.length) return vectorResults.slice(0, limit);

  return rrfMerge(vectorResults, kwResults, limit);
};

// ─── Keyword fallback ─────────────────────────────────────────────────────────
const keywordSearch = async (keyword, options = {}) => {
  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  // OR across every comma/space-separated term from Groq's keyword list
  const terms = keyword
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const regex = new RegExp(terms.join("|"), "i");

  return Product.find({
    $or: [{ name: regex }, { shortDescription: regex }, { description: regex }],
    isActive: { $ne: false },
    deletedAt: null,
    ...(options.categories?.length
      ? { category: { $in: options.categories } }
      : {}),
    ...(options.minPrice != null ? { price: { $gte: options.minPrice } } : {}),
    ...(options.maxPrice != null ? { price: { $lte: options.maxPrice } } : {}),
  })
    .select("name price shortDescription images inventory ratings category")
    .sort({ "ratings.average": -1 })
    .limit(limit)
    .lean();
};

// ─── Reciprocal Rank Fusion ───────────────────────────────────────────────────
const rrfMerge = (listA, listB, limit, weightA = 0.7, weightB = 0.3) => {
  const K = 60;
  const scores = new Map();
  const docs = new Map();

  const addList = (list, weight) =>
    list.forEach((doc, rank) => {
      const id = doc._id.toString();
      scores.set(id, (scores.get(id) ?? 0) + weight / (K + rank + 1));
      if (!docs.has(id)) docs.set(id, doc);
    });

  addList(listA, weightA);
  addList(listB, weightB);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score >= RRF_MIN_SCORE)
    .slice(0, limit)
    .map(([id, score]) => ({
      ...docs.get(id),
      similarityScore: parseFloat(score.toFixed(4)),
    }));
};

// ─── Categories for filter UI ─────────────────────────────────────────────────
export const getProductCategories = () =>
  Product.distinct("category", { isActive: { $ne: false }, deletedAt: null });
