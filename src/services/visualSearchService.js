// services/visualSearchService.js
// ─────────────────────────────────────────────────────────────────────────────
// Queries MongoDB Atlas using the IMAGE vector index (product_image_vector_index)
// which is separate from the TEXT index (product_vector_index) used by chatController.
//
// Field: imageEmbedding  (512-dim CLIP)
// Index: product_image_vector_index
// ─────────────────────────────────────────────────────────────────────────────

import Product from "../models/product.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const CANDIDATES_MULTIPLIER = 10;
const DEFAULT_MIN_SCORE = 0.6;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Build optional metadata post-filter */
const buildPostFilter = ({ categories, minPrice, maxPrice } = {}) => {
  const conditions = [{ isActive: { $ne: false } }, { deletedAt: null }];

  if (categories?.length) {
    conditions.push({ category: { $in: categories } });
  }

  if (minPrice != null || maxPrice != null) {
    const pf = {};
    if (minPrice != null) pf.$gte = Number(minPrice);
    if (maxPrice != null) pf.$lte = Number(maxPrice);
    conditions.push({ price: pf });
  }

  return { $and: conditions };
};

/** Shared projection — excludes both embedding fields */
const PRODUCT_PROJECTION = {
  _id: 1,
  name: 1,
  description: 1,
  shortDescription: 1,
  price: 1,
  compareAtPrice: 1,
  images: { $slice: ["$images", 1] },
  category: 1,
  inventory: 1,
  ratings: 1,
  isFeatured: 1,
  createdAt: 1,
  similarityScore: 1,
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure vector similarity search against imageEmbedding field.
 * Atlas index: product_image_vector_index  (512-dim, cosine)
 *
 * @param {number[]} queryEmbedding  512-dim CLIP query vector
 * @param {object}  options
 */
export const vectorImageSearch = async (queryEmbedding, options = {}) => {
  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const numCandidates = limit * CANDIDATES_MULTIPLIER;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const pipeline = [
    {
      $vectorSearch: {
        index: "image-vector-index", // ← image index, NOT product_vector_index
        path: "imageEmbedding", // ← image embedding field
        queryVector: queryEmbedding,
        numCandidates,
        limit: limit * 2,
      },
    },
    {
      $addFields: {
        similarityScore: { $meta: "vectorSearchScore" },
      },
    },
    {
      $match: {
        similarityScore: { $gte: minScore },
        ...buildPostFilter(options),
      },
    },
    {
      $project: PRODUCT_PROJECTION,
    },
    { $sort: { similarityScore: -1 } },
    { $limit: limit },
  ];

  return Product.aggregate(pipeline);
};

/**
 * Hybrid visual + keyword search using Reciprocal Rank Fusion.
 * Falls back to pure vector search when no keyword is provided.
 *
 * @param {number[]} queryEmbedding
 * @param {string}  [keyword]
 * @param {object}  [options]
 */
export const hybridVisualSearch = async (
  queryEmbedding,
  keyword,
  options = {},
) => {
  if (!keyword?.trim()) {
    return vectorImageSearch(queryEmbedding, options);
  }

  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

  const [visualResults, textResults] = await Promise.all([
    vectorImageSearch(queryEmbedding, { ...options, limit: limit * 2 }),
    keywordSearch(keyword, options),
  ]);

  return rrfMerge(visualResults, textResults, limit, 0.7, 0.3);
};

/**
 * Keyword fallback search for visual search (searches name/description/shortDescription).
 */
export const keywordSearch = async (keyword, options = {}) => {
  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const regex = new RegExp(keyword.replace(/\s+/g, "|"), "i");

  const filter = {
    $or: [{ name: regex }, { shortDescription: regex }, { description: regex }],
    isActive: { $ne: false },
    deletedAt: null,
    ...(options.categories?.length
      ? { category: { $in: options.categories } }
      : {}),
    ...(options.minPrice != null || options.maxPrice != null
      ? {
          price: {
            ...(options.minPrice != null ? { $gte: options.minPrice } : {}),
            ...(options.maxPrice != null ? { $lte: options.maxPrice } : {}),
          },
        }
      : {}),
  };

  return Product.find(filter)
    .select(
      "name price shortDescription description images inventory ratings category",
    )
    .sort({ "ratings.average": -1 })
    .limit(limit)
    .lean();
};

/** Reciprocal Rank Fusion — merges two ranked lists */
const rrfMerge = (listA, listB, limit, weightA = 0.7, weightB = 0.3) => {
  const K = 60;
  const scores = new Map();
  const docs = new Map();

  const addRRF = (list, weight) => {
    list.forEach((doc, rank) => {
      const id = doc._id.toString();
      scores.set(id, (scores.get(id) ?? 0) + weight / (K + rank + 1));
      if (!docs.has(id)) docs.set(id, doc);
    });
  };

  addRRF(listA, weightA);
  addRRF(listB, weightB);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({
      ...docs.get(id),
      similarityScore: parseFloat(score.toFixed(4)),
    }));
};

/** Returns distinct product categories (used by filter UI) */
export const getProductCategories = () =>
  Product.distinct("category", { isActive: { $ne: false }, deletedAt: null });
