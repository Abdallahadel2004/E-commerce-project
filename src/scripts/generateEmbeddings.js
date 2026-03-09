// scripts/generateEmbeddings.js
// Run this ONCE to backfill embeddings for all existing products.
// After this, new products should call generateEmbedding() on creation.
//
// Usage:
//   node scripts/generateEmbeddings.js
//
// Make sure your .env file has MONGODB_URI and HUGGINGFACE_API_KEY set.

import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

import mongoose from "mongoose";
import Product from "../models/product.js";
import {
  generateEmbedding,
  productToText,
} from "../services/embeddingService.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  // ── Connect to MongoDB ────────────────────────────────────────────────────
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Find all active products that don't have embeddings yet
  const products = await Product.find({
    isActive: true,
    deletedAt: null,
    embedding: { $exists: false },
  }).select("name description shortDescription seo");

  console.log(`📦 Found ${products.length} products without embeddings\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    process.stdout.write(`[${i + 1}/${products.length}] ${product.name}... `);

    try {
      const text = productToText(product);
      const embedding = await generateEmbedding(text);

      await Product.findByIdAndUpdate(product._id, { embedding });

      console.log(`✅ (${embedding.length}d)`);
      success++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }

    // HuggingFace free tier allows ~1 req/sec — be polite
    if (i < products.length - 1) await delay(1100);
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`─────────────────────────────`);
  console.log("\n📌 Next step: Create the Atlas Vector Search index.");
  console.log("   Go to Atlas → your cluster → Search → Create Search Index");
  console.log("   → JSON Editor → paste this:\n");
  console.log(
    JSON.stringify(
      {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: 384,
            similarity: "cosine",
          },
        ],
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
  console.log("\n✅ Done. Disconnected from MongoDB.");
};

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
