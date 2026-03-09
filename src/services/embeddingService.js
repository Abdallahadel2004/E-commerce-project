// services/embeddingService.js
const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";

// ─── FIX: Correct 2025 URL format — model ID comes BEFORE /pipeline/feature-extraction
//          Inputs must be an ARRAY ["text"], not a plain string "text"
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

export const productToText = (product) => {
  const parts = [
    product.name,
    product.shortDescription || "",
    product.description || "",
    product.seo?.keywords?.join(", ") || "",
  ];
  return parts.filter(Boolean).join(". ").slice(0, 1000);
};

export const generateEmbedding = async (text) => {
  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    // ─── FIX: inputs must be an array, not a plain string
    body: JSON.stringify({ inputs: [text] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Response is [[...embedding...]] — return the first (and only) element
  if (Array.isArray(data[0])) {
    return data[0];
  }
  return data;
};
