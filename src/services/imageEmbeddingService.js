// services/imageEmbeddingService.js
// Pipeline: Groq Vision → product description → sentence-transformer embedding

import crypto from "crypto";
import NodeCache from "node-cache";
import Groq from "groq-sdk";
import { generateEmbedding } from "./embeddingService.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const IMAGE_EMBEDDING_DIM = 384;

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 1000 });

// ─── Groq Vision → product description ───────────────────────────────────────

const VISION_PROMPT = `You are a visual product search engine for an e-commerce platform.

Analyze the uploaded image and identify ONLY the main product (ignore background, people, props, and scenery).

Return a structured description using EXACTLY this format:
CATEGORY: [single product category, e.g. "laptop", "running shoes", "gaming headset"]
TYPE: [specific product type, e.g. "ultrabook", "trail running shoe", "over-ear headphones"]
COLOR: [primary color(s)]
MATERIAL: [visible material, e.g. "aluminum", "mesh fabric", "leather"]
DESIGN: [key design descriptors, e.g. "slim profile", "chunky sole", "closed-back"]
STYLE: [style tags, e.g. "professional", "sporty", "minimalist"]
KEYWORDS: [5-8 comma-separated search keywords that precisely describe this product for matching similar items]

Rules:
- Focus ONLY on the main product, not accessories or background items
- Be as specific as possible about product type and category
- Keywords must reflect the exact product type — never use generic words like "item" or "product"
- Do NOT describe the background, lighting, or setting`;

const describeImageWithGroq = async (imageBuffer, mimeType = "image/jpeg") => {
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 250,
    temperature: 0.1, // lower = more deterministic, less creative drift
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("Groq returned empty description");

  // Extract the KEYWORDS line for the embedding — most signal-dense part
  const keywordsMatch = raw.match(/KEYWORDS:\s*(.+)/i);
  const categoryMatch = raw.match(/CATEGORY:\s*(.+)/i);
  const typeMatch = raw.match(/TYPE:\s*(.+)/i);
  const designMatch = raw.match(/DESIGN:\s*(.+)/i);

  // Build a focused query string: category + type + keywords (ignore color/style noise)
  const focusedQuery = [
    categoryMatch?.[1]?.trim(),
    typeMatch?.[1]?.trim(),
    designMatch?.[1]?.trim(),
    keywordsMatch?.[1]?.trim(),
  ]
    .filter(Boolean)
    .join(". ");

  const description = focusedQuery || raw; // fallback to full text if parsing fails

  console.log(`[ImageEmbedding] Raw Groq output:\n${raw}`);
  console.log(`[ImageEmbedding] Focused query: "${description}"`);
  return description;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const bufferHash = (buf) =>
  crypto.createHash("sha256").update(buf).digest("hex");

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateImageEmbedding = async (
  imageBuffer,
  mimeType = "image/jpeg",
) => {
  const key = bufferHash(imageBuffer);

  const cached = cache.get(key);
  if (cached) {
    console.log("[ImageEmbedding] Cache HIT");
    return cached;
  }

  const description = await describeImageWithGroq(imageBuffer, mimeType);
  const embedding = await generateEmbedding(description);

  if (embedding.length !== IMAGE_EMBEDDING_DIM)
    throw new Error(
      `Expected ${IMAGE_EMBEDDING_DIM}-dim, got ${embedding.length}`,
    );

  cache.set(key, embedding);
  return embedding;
};

export const generateImageEmbeddingFromUrl = async (imageUrl) => {
  const url = fixImageUrl(imageUrl);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = url.match(/\.png(\?|$)/i)
    ? "image/png"
    : url.match(/\.webp(\?|$)/i)
      ? "image/webp"
      : "image/jpeg";

  return generateImageEmbedding(buffer, mime);
};

export const fixImageUrl = (url) => {
  if (!url) return url;
  try {
    const p = new URL(url);
    if (p.hostname.includes("unsplash.com") && !p.search) {
      p.searchParams.set("w", "600");
      return p.toString();
    }
  } catch {
    /* not a valid URL */
  }
  return url;
};

export const getEmbeddingCacheStats = () => cache.getStats();
