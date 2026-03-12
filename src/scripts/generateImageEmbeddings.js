// src/scripts/generateImageEmbeddings.js
// Run ONCE after importing seed data to generate real imageEmbeddings.
//
// Usage (always run from project root):
//   node src/scripts/generateImageEmbeddings.js --all
//   node src/scripts/generateImageEmbeddings.js --limit 5
//   node src/scripts/generateImageEmbeddings.js --dry
//
// Prerequisites: .env in project root with MONGODB_URI, GROQ_API_KEY, HUGGINGFACE_API_KEY

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// ─── Load .env relative to THIS file (works regardless of CWD) ───────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env") });

import mongoose from "mongoose";
import Groq from "groq-sdk";

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE_ALL = args.includes("--all");
const DRY_RUN = args.includes("--dry");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i !== -1 ? parseInt(args[i + 1]) || 0 : 0;
})();

// ─── Config ───────────────────────────────────────────────────────────────────
const DELAY_MS = 600; // pause between products (HuggingFace rate limit)
const MAX_RETRIES = 3; // retries per product on transient failures
const RETRY_DELAY = 3000; // ms between retries
const IMAGE_DIM = 384; // must match your Atlas Vector Search index dimension

// ─── Groq client (after dotenv loaded) ───────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Product schema (minimal) ─────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    name: String,
    category: String,
    shortDescription: String,
    images: [{ url: String, isPrimary: Boolean }],
    imageEmbedding: [Number],
    imageEmbeddingGeneratedAt: Date,
  },
  { strict: false, collection: "products" },
);

// ─── HuggingFace embedding ────────────────────────────────────────────────────
async function generateEmbedding(text) {
  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) throw new Error("HUGGINGFACE_API_KEY not set in .env");

  const res = await fetch(
    "https://router.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace error ${res.status}: ${err}`);
  }

  const data = await res.json();
  // HF returns either a flat array or [[...]]
  const flat = Array.isArray(data[0]) ? data[0] : data;

  if (!Array.isArray(flat) || flat.length !== IMAGE_DIM) {
    throw new Error(`Expected ${IMAGE_DIM}-dim, got ${flat?.length}`);
  }
  return flat;
}

// ─── Groq Vision ──────────────────────────────────────────────────────────────
const VISION_PROMPT = `You are an expert e-commerce tagging assistant.
Analyze the product in the image. Your goal is to generate terms that a user would actually use to find this product.

Return EXACTLY this format:
CATEGORY: [e.g., "Electronics", "Footwear"]
TYPE: [e.g., "Digital Camera", "Running Shoes"]
SIMPLE_DESCRIPTION: [A 5-word description, e.g., "Black DSLR professional digital camera"]
SEARCH_KEYWORDS: [8-10 synonyms and broad terms, e.g., "camera, dslr, photography, lens, canon, nikon, digital"]

Rules:
- DO NOT use hyper-technical words like "ribbed", "bezel", or "shimmering".
- Focus on the core identity of the object.
- Include common brand names or styles that fit the visual.`;

async function describeImageWithGroq(imageBuffer, mimeType = "image/jpeg") {
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
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("Groq returned empty description");

  const category = raw.match(/CATEGORY:\s*(.+)/i)?.[1]?.trim() ?? "";
  const type = raw.match(/TYPE:\s*(.+)/i)?.[1]?.trim() ?? "";
  const simple = raw.match(/SIMPLE_DESCRIPTION:\s*(.+)/i)?.[1]?.trim() ?? "";
  const keywords = raw.match(/SEARCH_KEYWORDS:\s*(.+)/i)?.[1]?.trim() ?? "";

  // Repeat category+type twice for relevance weighting
  const query = [`${category} ${type}`, `${category} ${type}`, simple, keywords]
    .filter(Boolean)
    .join(". ");

  console.log(`   🤖 Groq: "${query.substring(0, 100)}…"`);
  return query;
}

// ─── Image download ───────────────────────────────────────────────────────────
function fixUnsplashUrl(url) {
  if (!url) return url;
  try {
    const p = new URL(url);
    if (p.hostname.includes("unsplash.com")) {
      p.searchParams.set("w", "600");
      p.searchParams.set("q", "80");
      return p.toString();
    }
  } catch {
    /* ignore invalid URLs */
  }
  return url;
}

async function downloadImage(rawUrl) {
  const url = fixUnsplashUrl(rawUrl);
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = /\.png(\?|$)/i.test(url)
    ? "image/png"
    : /\.webp(\?|$)/i.test(url)
      ? "image/webp"
      : "image/jpeg";
  return { buffer, mime };
}

// ─── Per-product pipeline ─────────────────────────────────────────────────────
async function processProduct(Product, product, index, total) {
  const tag = `[${index + 1}/${total}] ${product.name}`;
  const imgUrl = product.images?.[0]?.url;

  if (!imgUrl) {
    console.warn(`⚠  ${tag} — no image URL, skipping`);
    return { status: "skipped" };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n⏳  ${tag}${attempt > 1 ? ` (retry ${attempt})` : ""}`);

      const { buffer, mime } = await downloadImage(imgUrl);
      const description = await describeImageWithGroq(buffer, mime);
      const embedding = await generateEmbedding(description);

      console.log(`   ✅ ${embedding.length}-dim embedding generated`);

      if (!DRY_RUN) {
        await Product.findByIdAndUpdate(product._id, {
          imageEmbedding: embedding,
          imageEmbeddingGeneratedAt: new Date(),
        });
        console.log(`   💾 Saved to MongoDB`);
      }

      return { status: "ok" };
    } catch (err) {
      console.error(`   ✗ Attempt ${attempt}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.log(`   ↺ Waiting ${RETRY_DELAY / 1000}s before retry…`);
        await sleep(RETRY_DELAY);
      }
    }
  }

  return { status: "failed" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatDuration(ms) {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Support both MONGODB_URI and MONGO_URI
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("❌  MONGODB_URI not set in .env");
    process.exit(1);
  }

  if (!process.env.GROQ_API_KEY) {
    console.error("❌  GROQ_API_KEY not set in .env");
    process.exit(1);
  }

  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error("❌  HUGGINGFACE_API_KEY not set in .env");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB…");
  await mongoose.connect(mongoUri);
  const { host, name } = mongoose.connection;
  console.log(`✅  Connected: ${host} — db: ${name}\n`);

  const Product = mongoose.model("Product", productSchema);

  // ── Build query ──────────────────────────────────────────────────────────
  const query = FORCE_ALL
    ? { isActive: { $ne: false } }
    : {
        isActive: { $ne: false },
        $or: [
          { imageEmbedding: { $exists: false } },
          { imageEmbedding: { $size: 0 } },
          { imageEmbeddingGeneratedAt: { $exists: false } },
        ],
      };

  let products = await Product.find(query)
    .select(
      "name category shortDescription images imageEmbedding imageEmbeddingGeneratedAt",
    )
    .lean();

  if (LIMIT > 0) products = products.slice(0, LIMIT);

  const total = products.length;
  if (total === 0) {
    console.log("✅  All products already have real image embeddings.");
    await mongoose.disconnect();
    return;
  }

  console.log(`📦  Products to process : ${total}`);
  console.log(
    `🔧  Mode                : ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`,
  );
  console.log(
    `⏱   Estimated time      : ~${formatDuration(total * (DELAY_MS + 3500))}`,
  );
  console.log("─".repeat(60));

  let success = 0,
    failed = 0,
    skipped = 0;
  const t0 = Date.now();

  for (let i = 0; i < total; i++) {
    const result = await processProduct(Product, products[i], i, total);
    if (result.status === "ok") success++;
    else if (result.status === "failed") failed++;
    else skipped++;

    if (i < total - 1) await sleep(DELAY_MS);
  }

  const elapsed = Date.now() - t0;
  console.log("\n" + "═".repeat(60));
  console.log(`✅  Done in ${formatDuration(elapsed)}`);
  console.log(`   Success : ${success}`);
  console.log(`   Failed  : ${failed}`);
  console.log(`   Skipped : ${skipped}`);

  if (DRY_RUN) {
    console.log("\n⚠   DRY RUN — no changes were written to MongoDB.");
  }
  if (failed > 0) {
    console.log(
      `\n⚠   ${failed} product(s) failed. Re-run — already-done products are skipped.`,
    );
  }

  await mongoose.disconnect();
  console.log("\n🔌  Disconnected from MongoDB.");
}

main().catch((err) => {
  console.error("\n💥  Fatal error:", err.message);
  process.exit(1);
});
