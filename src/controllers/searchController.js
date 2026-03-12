// controllers/searchController.js
// AI-powered smart search using vector embeddings + hybrid fallback

import Product from "../models/product.js";
import Category from "../models/category.js";
import { generateEmbedding } from "../services/embeddingService.js";

const STOP_WORDS =
  /\b(show|me|find|i|need|want|looking|for|a|an|the|some|any|give|get|please|can|you|what|are|is|have|do|does|how|many|best|good|great)\b/gi;

export const smartSearch = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, page = 1, limit = 12 } = req.query;

    const hasQuery = q && q.trim().length > 0;
    const hasCategory = category && category !== "All Category";

    const query = hasQuery ? q.trim() : "";
    const skip = (page - 1) * limit;

    // ── Resolve category name → ObjectId for .find() queries ──────────────
    let categoryId = null;
    if (hasCategory) {
      const cat = await Category.findOne({ name: category });
      if (cat) categoryId = cat._id;
    }

    // ── Base MongoDB filter (for .find() — uses ObjectId) ─────────────────
    const baseFilter = { isActive: { $ne: false }, deletedAt: null };
    if (categoryId) baseFilter.category = categoryId;
    if (minPrice)
      baseFilter.price = { ...baseFilter.price, $gte: parseFloat(minPrice) };
    if (maxPrice)
      baseFilter.price = { ...baseFilter.price, $lte: parseFloat(maxPrice) };

    let products = [];
    let searchMethod = "keyword";

    // ── Category-only browse (no search query) ────────────────────────────
    if (!hasQuery) {
      products = await Product.find(baseFilter)
        .populate("category", "name")
        .select(
          "name price compareAtPrice shortDescription description images inventory ratings isFeatured soldCount category",
        )
        .sort({ "ratings.average": -1 });

      searchMethod = "keyword";
    } else {
      // ── Step 1: Embed query ─────────────────────────────────────────────
      try {
        const embedding = await generateEmbedding(query);

        // ── Step 2: Vector search (uses raw docs — filter by ObjectId) ────
        const vectorResults = await Product.aggregate([
          {
            $vectorSearch: {
              index: "product_vector_index",
              path: "embedding",
              queryVector: embedding,
              numCandidates: 400,
              limit: 50,
            },
          },
          {
            $project: {
              name: 1,
              price: 1,
              compareAtPrice: 1,
              shortDescription: 1,
              description: 1,
              category: 1,
              images: { $slice: ["$images", 1] },
              inventory: 1,
              ratings: 1,
              isActive: 1,
              deletedAt: 1,
              isFeatured: 1,
              soldCount: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
          {
            $match: {
              score: { $gte: 0.45 },
              isActive: { $ne: false },
              deletedAt: null,
              ...(categoryId ? { category: categoryId } : {}),
              ...(minPrice || maxPrice
                ? {
                    price: {
                      ...(minPrice ? { $gte: parseFloat(minPrice) } : {}),
                      ...(maxPrice ? { $lte: parseFloat(maxPrice) } : {}),
                    },
                  }
                : {}),
            },
          },
        ]);

        console.log(
          `Smart search "${query}": ${vectorResults.length} vector results`,
        );
        if (vectorResults.length > 0) {
          console.log(
            "Scores:",
            vectorResults
              .slice(0, 5)
              .map((p) => `${p.name}: ${p.score?.toFixed(3)}`),
          );
        }

        if (vectorResults.length >= 2) {
          products = vectorResults;
          searchMethod = "vector";
        } else {
          // ── Step 3: Hybrid — merge vector + keyword ───────────────────
          const vectorIds = new Set(vectorResults.map((p) => p._id.toString()));
          const keywords = query
            .replace(STOP_WORDS, " ")
            .replace(/\s+/g, " ")
            .trim();
          const regex = new RegExp(
            keywords
              .split(" ")
              .filter((w) => w.length > 1)
              .map((w) => `(?=.*${w})`)
              .join(""),
            "i",
          );

          const keywordResults = await Product.find({
            $or: [
              { name: regex },
              { description: regex },
              { shortDescription: regex },
            ],
            ...baseFilter,
          })
            .populate("category", "name")
            .select(
              "name price compareAtPrice shortDescription description images inventory ratings isFeatured soldCount category",
            )
            .sort({ "ratings.average": -1 })
            .limit(20);

          const keywordNew = keywordResults
            .filter((p) => !vectorIds.has(p._id.toString()))
            .map((p) => ({ ...p.toObject(), score: 0 }));

          products = [...vectorResults, ...keywordNew];
          searchMethod = "hybrid";
          console.log(
            `Hybrid: ${vectorResults.length} vector + ${keywordNew.length} keyword`,
          );
        }
      } catch (embErr) {
        // ── Pure keyword fallback if embedding fails ────────────────────
        console.error("Embedding failed, using keyword search:", embErr.message);
        const keywords = query
          .replace(STOP_WORDS, " ")
          .replace(/\s+/g, " ")
          .trim();
        const regex = new RegExp(keywords, "i");

        products = await Product.find({
          $or: [
            { name: regex },
            { description: regex },
            { shortDescription: regex },
          ],
          ...baseFilter,
        })
          .populate("category", "name")
          .select(
            "name price compareAtPrice shortDescription description images inventory ratings isFeatured soldCount",
          )
          .sort({ "ratings.average": -1 });

        searchMethod = "keyword";
      }
    }

    // ── Pagination ────────────────────────────────────────────────────────────
    const total = products.length;
    const paginated = products.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      query,
      searchMethod,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products: paginated,
    });
  } catch (error) {
    console.error("Smart search error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Quick suggest: top 5 results for dropdown preview ────────────────────────
export const searchSuggest = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2)
      return res.json({ success: true, products: [] });

    const query = q.trim();
    let products = [];

    try {
      const embedding = await generateEmbedding(query);

      products = await Product.aggregate([
        {
          $vectorSearch: {
            index: "product_vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 100,
            limit: 10,
          },
        },
        {
          $project: {
            name: 1,
            price: 1,
            shortDescription: 1,
            images: { $slice: ["$images", 1] },
            ratings: 1,
            isActive: 1,
            deletedAt: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
        {
          $match: {
            score: { $gte: 0.55 },
            isActive: { $ne: false },
            deletedAt: null,
          },
        },
        { $limit: 5 },
      ]);
    } catch {
      // Keyword fallback for suggestions
      const regex = new RegExp(query, "i");
      products = await Product.find({
        $or: [{ name: regex }, { shortDescription: regex }],
        isActive: { $ne: false },
        deletedAt: null,
      })
        .select("name price shortDescription images ratings")
        .limit(5);
    }

    res.json({
      success: true,
      products: products.map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        shortDescription: p.shortDescription,
        image: p.images?.[0]?.url || null,
        rating: p.ratings?.average || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
