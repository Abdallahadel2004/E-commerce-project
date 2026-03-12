// services/imageEmbeddingService.js
// Image → Groq Vision (description) → HuggingFace embedding (384-dim)
// Reuses the same embeddingService used for product text embeddings.

import crypto from "crypto";
import NodeCache from "node-cache";
import Groq from "groq-sdk";
import { generateEmbedding } from "./embeddingService.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const cache = new NodeCache({ stdTTL: 3600, maxKeys: 500 });

const VISION_PROMPT = `You are an expert e-commerce tagging assistant.
Analyze the product in the image and generate terms a user would actually search for.

Return EXACTLY this format:
CATEGORY: [e.g., "Electronics", "Footwear"]
TYPE: [e.g., "Digital Camera", "Running Shoes"]
SIMPLE_DESCRIPTION: [5-word description, e.g., "Black DSLR professional digital camera"]
SEARCH_KEYWORDS: [8-10 synonyms, e.g., "camera, dslr, photography, lens, canon, nikon, digital"]

Rules:
- NO technical jargon like "ribbed", "bezel", "shimmering"
- Focus on the core identity of the product
- Include common brand names that match the visual`;

const describeImage = async (imageBuffer, mimeType = "image/jpeg") => {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

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
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("Groq returned empty response");

  const category = raw.match(/CATEGORY:\s*(.+)/i)?.[1]?.trim() ?? "";
  const type = raw.match(/TYPE:\s*(.+)/i)?.[1]?.trim() ?? "";
  const simple = raw.match(/SIMPLE_DESCRIPTION:\s*(.+)/i)?.[1]?.trim() ?? "";
  const keywords = raw.match(/SEARCH_KEYWORDS:\s*(.+)/i)?.[1]?.trim() ?? "";

  // Single category+type mention — keeps the embedding focused on identity
  // rather than artificially amplifying it via repetition
  const query = [`${category} ${type}`, simple, keywords]
    .filter(Boolean)
    .join(". ");

  console.log(`[ImageEmbedding] Groq:\n${raw}`);
  console.log(`[ImageEmbedding] Query: "${query}"`);

  // `type` is the most specific Groq signal (e.g. "Digital Camera") —
  // returned separately so the keyword fallback can search on it strictly
  // before broadening to the full keyword list.
  return { query, type, keywords };
};

/**
 * Converts an uploaded image buffer into a 384-dim embedding plus the
 * raw keyword string extracted by Groq — so the caller can use keywords
 * as a hybrid-search fallback when vector scores are low.
 *
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @returns {Promise<{ embedding: number[], type: string, keywords: string }>}
 */
export const imageToEmbedding = async (
  imageBuffer,
  mimeType = "image/jpeg",
) => {
  const cacheKey = crypto
    .createHash("sha256")
    .update(imageBuffer)
    .digest("hex");

  const cached = cache.get(cacheKey);
  if (cached) {
    console.log("[ImageEmbedding] Cache HIT");
    return cached;
  }

  const { query, type, keywords } = await describeImage(imageBuffer, mimeType);
  const embedding = await generateEmbedding(query);

  const result = { embedding, type, keywords };
  cache.set(cacheKey, result);
  return result;
};

export const getEmbeddingCacheStats = () => cache.getStats();
