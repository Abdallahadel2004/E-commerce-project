// scripts/fixMissingEmbeddings.js
import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

import mongoose from "mongoose";
import Product from "../models/product.js";
import { embedProduct } from "../services/autoEmbedService.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const products = await Product.find({
    embedding: { $exists: false },
    isActive: true,
    deletedAt: null,
  }).select("name description shortDescription seo");

  console.log(`📦 Found ${products.length} products without embeddings`);

  if (products.length === 0) {
    console.log("✅ All products already have embeddings!");
    await mongoose.disconnect();
    return;
  }

  for (const product of products) {
    await embedProduct(product);
  }

  console.log("\n✅ Done!");
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
