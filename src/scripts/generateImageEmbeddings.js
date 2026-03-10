// scripts/generateImageEmbeddings.js
// ─────────────────────────────────────────────────────────────────────────────
// Backfill imageEmbedding for all products using their text (name + description).
//
// Why text instead of Gemini Vision here?
//   - The seeded products already have rich names and descriptions in the DB.
//   - Gemini is only needed at SEARCH TIME when a user uploads an unknown image.
//   - This script runs once, works offline, no vision API key required.
//
// At search time, visualSearchController generates a Gemini description of the
// uploaded image, embeds it, then searches against these text-based embeddings.
// Both live in the same 384-dim vector space → similarity works correctly.
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

import mongoose from "mongoose";
import Product from "../models/product.js";
import {
  generateEmbedding,
  productToText,
} from "../services/embeddingService.js";

const FORCE = process.argv.includes("--force");
const DELAY_MS = 1100; // HuggingFace free tier: ~1 req/sec

const run = async () => {
  // ── Sanity-check env ────────────────────────────────────────────────────────
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error("❌ HUGGINGFACE_API_KEY is not set in .env");
    process.exit(1);
  }
  console.log(
    `🔑 HF key loaded: ${process.env.HUGGINGFACE_API_KEY.slice(0, 8)}…`,
  );

  console.log("🔗 Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected\n");

  const query = FORCE
    ? { isActive: { $ne: false }, deletedAt: null }
    : {
        isActive: { $ne: false },
        deletedAt: null,
        $or: [
          { imageEmbedding: { $exists: false } },
          { imageEmbedding: { $size: 0 } },
        ],
      };

  const products = await Product.find(query)
    .select("+imageEmbedding name description shortDescription seo")
    .lean();

  console.log(`📦 ${products.length} products to process (force=${FORCE})\n`);

  if (products.length === 0) {
    console.log("Nothing to do — all products already have image embeddings.");
    await mongoose.disconnect();
    return process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    process.stdout.write(`  ⏳ [${i + 1}/${products.length}] ${product.name}…`);

    try {
      // Use the same productToText helper used by the chat embedding script
      const text = productToText(product);
      const embedding = await generateEmbedding(text);

      await Product.findByIdAndUpdate(product._id, {
        imageEmbedding: embedding,
        imageEmbeddingGeneratedAt: new Date(),
      });

      process.stdout.write(` ✓ (${embedding.length}-dim)\n`);
      success++;
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
      failed++;
    }

    if (i < products.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`
╔══════════════════════════════════╗
║   Image Embedding Generation     ║
╠══════════════════════════════════╣
║  ✓ Success : ${String(success).padEnd(20)}║
║  ✗ Failed  : ${String(failed).padEnd(20)}║
╚══════════════════════════════════╝`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
