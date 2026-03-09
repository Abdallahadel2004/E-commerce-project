// services/autoEmbedService.js
import Product from "../models/product.js";
import { generateEmbedding, productToText } from "./embeddingService.js";

export const embedProduct = async (product) => {
  try {
    console.log(`🔄 Generating embedding for: ${product.name}`);
    const text = productToText(product);
    console.log(`📝 Text to embed: ${text.slice(0, 100)}...`);

    const embedding = await generateEmbedding(text);

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(
        `Invalid embedding returned: ${JSON.stringify(embedding)}`,
      );
    }

    await Product.findByIdAndUpdate(product._id, { embedding });
    console.log(
      `✅ Embedding saved for: ${product.name} (${embedding.length}d)`,
    );
  } catch (err) {
    console.error(`❌ Failed to embed "${product.name}": ${err.message}`);
  }
};
