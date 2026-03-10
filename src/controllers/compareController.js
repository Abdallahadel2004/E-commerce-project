// controllers/compareController.js
// AI-powered product comparison — side-by-side specs + conversational Q&A

import Product from "../models/product.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/compare?ids=id1,id2,id3
// Returns full product data for the comparison table
// ─────────────────────────────────────────────────────────────────────────────
export const getCompareProducts = async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids)
      return res
        .status(400)
        .json({ success: false, message: "Product IDs required." });

    const idList = ids
      .split(",")
      .slice(0, 3)
      .map((id) => id.trim())
      .filter(Boolean);
    if (idList.length < 2)
      return res
        .status(400)
        .json({ success: false, message: "At least 2 product IDs required." });

    const products = await Product.find({ _id: { $in: idList } })
      .populate("category", "name")
      .select("-embedding -__v");

    if (products.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Products not found." });
    }

    // Build unified spec rows — fields that exist in at least one product
    const specRows = buildSpecRows(products);

    // AI-generated comparison summary
    const summary = await generateSummary(products);

    res.json({
      success: true,
      products: products.map(formatProduct),
      specRows,
      summary,
    });
  } catch (error) {
    console.error("Compare error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/compare/ask
// AI answers a question about the compared products
// Body: { productIds: [...], question: string, history: [...] }
// ─────────────────────────────────────────────────────────────────────────────
export const askAboutProducts = async (req, res) => {
  try {
    const { productIds, question, history = [] } = req.body;

    if (!question?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Question required." });
    if (!productIds?.length || productIds.length < 2)
      return res
        .status(400)
        .json({ success: false, message: "At least 2 product IDs required." });

    const products = await Product.find({
      _id: { $in: productIds.slice(0, 3) },
    })
      .populate("category", "name")
      .select("-embedding -__v");

    if (products.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Products not found." });
    }

    // Build rich product context for LLM
    const productContext = products
      .map((p, i) => {
        const stock =
          (p.inventory?.quantity || 0) > 0
            ? `In stock (${p.inventory.quantity} units)`
            : "Out of stock";

        return `
PRODUCT ${i + 1}: ${p.name}
- Price: $${p.price}${p.compareAtPrice ? ` (was $${p.compareAtPrice})` : ""}
- Category: ${p.category?.name || "N/A"}
- Rating: ${p.ratings?.average || "No ratings"}/5 (${p.ratings?.count || 0} reviews)
- Stock: ${stock}
- Description: ${p.description || p.shortDescription || "No description available"}
- Featured: ${p.isFeatured ? "Yes" : "No"}
- Sold: ${p.soldCount || 0} units
`.trim();
      })
      .join("\n\n");

    // Build conversation history
    const messages = [
      {
        role: "system",
        content: `You are an expert product comparison assistant for an e-commerce store called Electro.
You help users make informed purchasing decisions by comparing products honestly and helpfully.

You have been given data for ${products.length} products the user is comparing.
Only use the product data provided — never invent specifications or features.
Be concise, clear, and give a direct recommendation when asked.
Format your response with clear structure — use bullet points or short paragraphs.

PRODUCT DATA:
${productContext}`,
      },
      // Inject conversation history
      ...history.slice(-6).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      })),
      // Current question
      { role: "user", content: question.trim() },
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 600,
      temperature: 0.3,
    });

    const reply = completion.choices[0].message.content.trim();

    res.json({ success: true, reply });
  } catch (error) {
    console.error("Compare ask error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Build spec rows for the comparison table
const buildSpecRows = (products) => [
  {
    label: "Price",
    icon: "fa-tag",
    values: products.map((p) => ({
      value: `$${p.price?.toFixed(2)}`,
      highlight: false,
    })),
    type: "price",
  },
  {
    label: "Original Price",
    icon: "fa-percent",
    values: products.map((p) => ({
      value: p.compareAtPrice ? `$${p.compareAtPrice?.toFixed(2)}` : "—",
      highlight: false,
    })),
    type: "text",
  },
  {
    label: "Rating",
    icon: "fa-star",
    values: (() => {
      const ratings = products.map((p) => p.ratings?.average || 0);
      const best = Math.max(...ratings);
      return products.map((p) => ({
        value: p.ratings?.average
          ? `${p.ratings.average}/5 (${p.ratings.count || 0} reviews)`
          : "No ratings",
        highlight: (p.ratings?.average || 0) === best && best > 0,
      }));
    })(),
    type: "rating",
  },
  {
    label: "Availability",
    icon: "fa-boxes",
    values: products.map((p) => {
      const qty = p.inventory?.quantity || 0;
      const inStock = qty > 0;
      return {
        value: inStock ? `In Stock (${qty})` : "Out of Stock",
        inStock,
        highlight: inStock,
      };
    }),
    type: "stock",
  },
  {
    label: "Category",
    icon: "fa-layer-group",
    values: products.map((p) => ({
      value: p.category?.name || "Uncategorized",
      highlight: false,
    })),
    type: "text",
  },
  {
    label: "Popularity",
    icon: "fa-fire",
    values: (() => {
      const sold = products.map((p) => p.soldCount || 0);
      const best = Math.max(...sold);
      return products.map((p) => ({
        value: `${p.soldCount || 0} sold`,
        highlight: (p.soldCount || 0) === best && best > 0,
      }));
    })(),
    type: "text",
  },
  {
    label: "Featured",
    icon: "fa-certificate",
    values: products.map((p) => ({
      value: p.isFeatured ? "✅ Yes" : "—",
      highlight: p.isFeatured,
    })),
    type: "text",
  },
  {
    label: "Description",
    icon: "fa-align-left",
    values: products.map((p) => ({
      value: p.shortDescription || p.description?.substring(0, 120) || "—",
      highlight: false,
    })),
    type: "long",
  },
];

// AI-generated 2-sentence summary of which product wins and why
const generateSummary = async (products) => {
  try {
    const list = products
      .map(
        (p, i) =>
          `Product ${i + 1}: ${p.name} — $${p.price}, rated ${p.ratings?.average || "N/A"}/5, ${(p.inventory?.quantity || 0) > 0 ? "in stock" : "out of stock"}`,
      )
      .join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Compare these products briefly in 2 sentences. State which is best value and why:\n${list}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.3,
    });

    return completion.choices[0].message.content.trim();
  } catch {
    return null;
  }
};

const formatProduct = (p) => ({
  _id: p._id,
  name: p.name,
  price: p.price,
  compareAtPrice: p.compareAtPrice,
  shortDescription: p.shortDescription,
  description: p.description,
  image: p.images?.[0]?.url || null,
  images: p.images?.slice(0, 3),
  inStock: (p.inventory?.quantity || 0) > 0,
  inventory: p.inventory,
  ratings: p.ratings,
  category: p.category,
  isFeatured: p.isFeatured,
  soldCount: p.soldCount,
});
