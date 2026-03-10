// controllers/setupBuilderController.js
import Product from "../models/product.js";
import mongoose from "mongoose";
import { generateEmbedding } from "../services/embeddingService.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Minimum vector similarity score — below this the product is considered unrelated
// and will be rejected even if it's the best available match.
// Range: 0.0–1.0. Raise to be stricter, lower if too few results.
const MIN_RELEVANCE_SCORE = 0.7;

// ─────────────────────────────────────────────────────────────────────────────
// SETUP TEMPLATES
// Each component has:
//   query       — rich descriptive sentence used for embedding (more words = better)
//   keywords    — words that MUST appear somewhere in the product name/description
//                 (hard filter, prevents "wheat field" returning as a keyboard)
//   budgetShare — fraction of total budget allocated to this component
// ─────────────────────────────────────────────────────────────────────────────
const SETUP_TEMPLATES = {
  gaming_setup: {
    label: "Gaming Setup",
    components: [
      {
        id: "monitor",
        icon: "🖥️",
        budgetShare: 0.38,
        query:
          "gaming monitor display screen high refresh rate 144hz 1080p 1440p FPS",
        keywords: ["monitor", "display", "screen"],
      },
      {
        id: "keyboard",
        icon: "⌨️",
        budgetShare: 0.18,
        query: "mechanical gaming keyboard RGB backlit switches typing",
        keywords: ["keyboard"],
      },
      {
        id: "mouse",
        icon: "🖱️",
        budgetShare: 0.14,
        query: "gaming mouse high DPI optical sensor precise click buttons",
        keywords: ["mouse"],
      },
      {
        id: "headset",
        icon: "🎧",
        budgetShare: 0.2,
        query: "gaming headset headphones surround sound microphone over-ear",
        keywords: ["headset", "headphone", "earphone"],
      },
      {
        id: "mousepad",
        icon: "🖱️",
        budgetShare: 0.1,
        query: "gaming mousepad large desk mat extended surface smooth",
        keywords: ["mousepad", "mouse pad", "desk mat"],
      },
    ],
  },

  home_office_setup: {
    label: "Home Office Setup",
    components: [
      {
        id: "monitor",
        icon: "🖥️",
        budgetShare: 0.35,
        query:
          "office monitor widescreen display screen productivity IPS panel",
        keywords: ["monitor", "display", "screen"],
      },
      {
        id: "keyboard",
        icon: "⌨️",
        budgetShare: 0.18,
        query: "wireless office keyboard ergonomic compact typing bluetooth",
        keywords: ["keyboard"],
      },
      {
        id: "mouse",
        icon: "🖱️",
        budgetShare: 0.12,
        query: "wireless ergonomic office mouse comfortable grip scroll wheel",
        keywords: ["mouse"],
      },
      {
        id: "webcam",
        icon: "📷",
        budgetShare: 0.2,
        query: "webcam HD 1080p video calls meetings USB camera autofocus",
        keywords: ["webcam", "camera", "web cam"],
      },
      {
        id: "headset",
        icon: "🎧",
        budgetShare: 0.15,
        query:
          "office headset noise cancelling microphone calls meetings over-ear",
        keywords: ["headset", "headphone", "earphone"],
      },
    ],
  },

  streaming_setup: {
    label: "Streaming Setup",
    components: [
      {
        id: "microphone",
        icon: "🎙️",
        budgetShare: 0.28,
        query:
          "USB condenser microphone streaming podcast recording cardioid studio",
        keywords: ["microphone", "mic"],
      },
      {
        id: "webcam",
        icon: "📷",
        budgetShare: 0.25,
        query: "webcam 1080p 4K streaming broadcast live camera USB autofocus",
        keywords: ["webcam", "camera", "web cam"],
      },
      {
        id: "lighting",
        icon: "💡",
        budgetShare: 0.18,
        query:
          "ring light LED studio lighting video streaming photography fill light",
        keywords: ["light", "lamp", "led"],
      },
      {
        id: "capture",
        icon: "🎛️",
        budgetShare: 0.29,
        query:
          "stream deck capture card HDMI video game capture controller streaming",
        keywords: ["capture", "stream deck", "hdmi"],
      },
    ],
  },

  photography_setup: {
    label: "Photography Starter Kit",
    components: [
      {
        id: "camera",
        icon: "📸",
        budgetShare: 0.5,
        query:
          "digital camera DSLR mirrorless photography beginner sensor lens mount",
        keywords: ["camera"],
      },
      {
        id: "lens",
        icon: "🔭",
        budgetShare: 0.25,
        query: "camera lens portrait prime 50mm zoom photography glass mount",
        keywords: ["lens"],
      },
      {
        id: "tripod",
        icon: "📐",
        budgetShare: 0.12,
        query:
          "camera tripod lightweight stable aluminum travel photography stand",
        keywords: ["tripod", "stand", "monopod"],
      },
      {
        id: "bag",
        icon: "🎒",
        budgetShare: 0.13,
        query:
          "camera bag backpack waterproof padded photography gear storage carry",
        keywords: ["bag", "backpack", "case"],
      },
    ],
  },

  content_creator_setup: {
    label: "Content Creator Setup",
    components: [
      {
        id: "laptop",
        icon: "💻",
        budgetShare: 0.4,
        query:
          "laptop notebook computer video editing content creation fast processor GPU",
        keywords: ["laptop", "notebook", "computer"],
      },
      {
        id: "microphone",
        icon: "🎙️",
        budgetShare: 0.18,
        query:
          "USB microphone podcast recording condenser cardioid voice clarity",
        keywords: ["microphone", "mic"],
      },
      {
        id: "webcam",
        icon: "📷",
        budgetShare: 0.16,
        query: "webcam HD 1080p USB recording streaming video camera",
        keywords: ["webcam", "camera", "web cam"],
      },
      {
        id: "lighting",
        icon: "💡",
        budgetShare: 0.14,
        query: "softbox ring light LED panel studio video photography lighting",
        keywords: ["light", "lamp", "led"],
      },
      {
        id: "storage",
        icon: "💾",
        budgetShare: 0.12,
        query:
          "external SSD portable hard drive fast USB storage video editing backup",
        keywords: ["ssd", "hard drive", "storage", "hdd", "disk"],
      },
    ],
  },
};

const setupCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/setup-builder
// ─────────────────────────────────────────────────────────────────────────────
export const buildSetup = async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      setupType,
      customPrompt,
      budget,
      excludeProductIds = [],
    } = req.body;

    let template, label;

    if (customPrompt?.trim()) {
      label = customPrompt.trim();
      template = await generateCustomTemplate(customPrompt.trim(), budget);
      if (!template) {
        return res.status(400).json({
          success: false,
          message:
            "Could not understand your setup request. Try being more specific.",
        });
      }
    } else if (setupType && SETUP_TEMPLATES[setupType]) {
      template = SETUP_TEMPLATES[setupType];
      label = template.label;
    } else {
      return res.status(400).json({
        success: false,
        message: `Provide a setupType or customPrompt. Valid presets: ${Object.keys(SETUP_TEMPLATES).join(", ")}`,
      });
    }

    // Cache disabled — re-enable once deduplication is confirmed stable
    const cacheKey = `${setupType || customPrompt}_${budget || "any"}`;
    const cached = false && setupCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ ...cached.data, fromCache: true });
    }

    console.log(
      `\n[SetupBuilder] ▶ Building "${label}" | budget: $${budget || "any"} | components: ${template.components.length}`,
    );

    // Sequential — seed with IDs from previous result so regenerate never repeats
    const usedIds = excludeProductIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => id.toString());
    const products = [];

    for (const component of template.components) {
      const result = await findBestProduct(component, budget, usedIds);
      if (result) {
        products.push(result);
        usedIds.push(result._id.toString());
        console.log(
          `[SetupBuilder]   ✓ [${component.id}] → "${result.name}" (score: ${result.vectorScore})`,
        );
      } else {
        console.log(
          `[SetupBuilder]   ✗ [${component.id}] → no relevant product found — skipped`,
        );
      }
    }

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No matching products found in the store for this setup. Try a different setup type or remove the budget limit.",
      });
    }

    const totalPrice = products.reduce((sum, p) => sum + (p.price || 0), 0);
    const explanation = await generateExplanation(label, products, budget);

    const responseData = {
      success: true,
      setupType: setupType || "custom",
      label,
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      budget: budget || null,
      explanation,
      products,
      generatedIn: `${Date.now() - startTime}ms`,
    };

    setupCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    console.log(
      `[SetupBuilder] ✅ Done in ${Date.now() - startTime}ms — ${products.length}/${template.components.length} components found\n`,
    );

    res.json(responseData);
  } catch (err) {
    console.error("[SetupBuilder] Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTemplates = (req, res) => {
  const templates = Object.entries(SETUP_TEMPLATES).map(([key, val]) => ({
    key,
    label: val.label,
    components: val.components.map((c) => ({ id: c.id, icon: c.icon })),
  }));
  res.json({ success: true, templates });
};

// ─────────────────────────────────────────────────────────────────────────────
// LLM — generate component list from a free-text custom prompt
// ─────────────────────────────────────────────────────────────────────────────
async function generateCustomTemplate(prompt, budget) {
  try {
    const budgetNote = budget ? ` with a total budget of $${budget}` : "";
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a product setup planner for an electronics and tech e-commerce store.
Given a setup goal, return ONLY a valid JSON array of components needed.
Each item must have:
  "id": short snake_case identifier
  "query": rich descriptive product search sentence (10-15 words, include product type + key features)
  "keywords": array of 2-4 lowercase words that MUST appear in a matching product name or description
  "icon": single relevant emoji
  "budgetShare": decimal (all must sum to exactly 1.0)
Return 3–5 components. No markdown, no explanation, only the raw JSON array.`,
        },
        {
          role: "user",
          content: `Setup goal: "${prompt}"${budgetNote}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content.trim();
    const json = raw.replace(/```json|```/g, "").trim();
    const components = JSON.parse(json);

    if (!Array.isArray(components) || components.length === 0) return null;

    // Normalise budgetShares to sum exactly to 1.0
    const total = components.reduce((s, c) => s + (c.budgetShare || 0), 0);
    const normalized = components.map((c) => ({
      id: c.id || c.label?.toLowerCase().replace(/\s+/g, "_"),
      query: c.query || c.label,
      keywords: Array.isArray(c.keywords)
        ? c.keywords.map((k) => k.toLowerCase())
        : [],
      icon: c.icon || "📦",
      budgetShare:
        total > 0 ? (c.budgetShare || 0) / total : 1 / components.length,
    }));

    return { label: prompt, components: normalized };
  } catch (err) {
    console.warn(
      "[SetupBuilder] Custom template generation failed:",
      err.message,
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR SEARCH — with relevance threshold + keyword guard
// ─────────────────────────────────────────────────────────────────────────────
async function findBestProduct(component, budget, excludeIds = []) {
  try {
    const embedding = await generateEmbedding(component.query);
    const maxPrice = budget ? budget * component.budgetShare * 1.5 : null;

    const excludeObjectIds = excludeIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const pipeline = [
      {
        $vectorSearch: {
          index: "product_vector_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 400,
          limit: 50, // fetch 50 — keyword + threshold filter whittles it down
        },
      },
      // Capture score IMMEDIATELY — only valid right after $vectorSearch
      {
        $addFields: {
          _vsScore: { $meta: "vectorSearchScore" },
          _compositeScore: {
            $add: [
              { $multiply: [{ $meta: "vectorSearchScore" }, 0.6] },
              {
                $multiply: [
                  { $divide: [{ $ifNull: ["$ratings.average", 0] }, 5] },
                  0.25,
                ],
              },
              {
                $multiply: [
                  {
                    $min: [
                      { $divide: [{ $ifNull: ["$soldCount", 0] }, 100] },
                      1,
                    ],
                  },
                  0.15,
                ],
              },
            ],
          },
        },
      },
      // Hard filters AFTER score capture
      {
        $match: {
          isActive: { $ne: false },
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
          // Must meet minimum relevance — rejects completely unrelated products
          _vsScore: { $gte: MIN_RELEVANCE_SCORE },
          ...(maxPrice ? { price: { $lte: maxPrice } } : {}),
          ...(excludeObjectIds.length
            ? { _id: { $nin: excludeObjectIds } }
            : {}),
        },
      },
      { $sort: { _compositeScore: -1 } },
      { $limit: 5 }, // get top 5 that passed the threshold
      { $project: { embedding: 0, __v: 0 } },
    ];

    const candidates = await Product.aggregate(pipeline);

    if (!candidates.length) {
      console.log(
        `[SetupBuilder]     No candidates above threshold (${MIN_RELEVANCE_SCORE}) for "${component.id}"`,
      );
      return null;
    }

    // ── Keyword guard — prefer products whose name/description contains
    //    at least one of the component's expected keywords.
    //    If none pass, fall back to the highest-scoring candidate anyway
    //    (better to show something than nothing, but log a warning).
    const keywords = (component.keywords || []).map((k) => k.toLowerCase());

    let winner = null;
    if (keywords.length > 0) {
      winner = candidates.find((p) => {
        const text = [
          p.name,
          p.shortDescription,
          p.description,
          p.category?.name,
          p.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      });

      if (!winner) {
        console.warn(
          `[SetupBuilder]     ⚠ keyword guard failed for "${component.id}" — keywords: [${keywords.join(", ")}], best candidate: "${candidates[0].name}". Skipping.`,
        );
        return null; // strict: return null so an unrelated product is never shown
      }
    } else {
      winner = candidates[0];
    }

    return {
      componentId: component.id,
      componentLabel:
        (component.label || component.id).charAt(0).toUpperCase() +
        (component.label || component.id).slice(1),
      icon: component.icon,
      _id: winner._id,
      name: winner.name,
      price: winner.price,
      image: winner.images?.[0]?.url || null,
      shortDescription:
        winner.shortDescription || winner.description?.substring(0, 100) || "",
      rating: winner.ratings?.average || 0,
      ratingCount: winner.ratings?.count || 0,
      inStock: (winner.inventory?.quantity || 0) > 0,
      vectorScore: parseFloat((winner._vsScore || 0).toFixed(3)),
      compositeScore: parseFloat((winner._compositeScore || 0).toFixed(3)),
    };
  } catch (err) {
    console.warn(
      `[SetupBuilder] findBestProduct failed for "${component.id}":`,
      err.message,
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM — friendly bundle explanation
// ─────────────────────────────────────────────────────────────────────────────
async function generateExplanation(label, products, budget) {
  try {
    const list = products
      .map((p) => `- ${p.componentLabel}: ${p.name} ($${p.price})`)
      .join("\n");
    const budgetNote = budget ? ` within a $${budget} budget` : "";

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Write a friendly 2-sentence summary of this ${label}${budgetNote}. Explain why these specific products work well together.\n\n${list}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.4,
    });
    return completion.choices[0].message.content.trim();
  } catch {
    return `A carefully selected ${label} — every product chosen to work perfectly together.`;
  }
}
