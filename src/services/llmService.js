// services/llmService.js
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const generateChatResponse = async (
  userMessage,
  relevantProducts = [],
  history = [],
  totalProducts = 0,
  retrievalMethod = "vector",
) => {
  // ── Build product context block ───────────────────────────────────────────
  let productContext;

  if (relevantProducts.length === 0) {
    productContext = "No products found for this query.";
  } else {
    const isExact =
      retrievalMethod === "vector" || retrievalMethod === "hybrid";
    const isFallback = retrievalMethod === "fallback";

    productContext = relevantProducts
      .map((p, i) => {
        const stock =
          (p.inventory?.quantity || 0) > 0 ? "(In Stock)" : "(Out of Stock)";
        const desc = p.shortDescription ? ` — ${p.shortDescription}` : "";
        return `${i + 1}. ${p.name} — $${p.price}${desc} ${stock}`;
      })
      .join("\n");

    if (isFallback) {
      productContext = `[These are our top-rated products shown as a general recommendation since no exact match was found]\n${productContext}`;
    }
  }

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemContent = `You are a friendly and knowledgeable shopping assistant for an e-commerce store called Electro.

CRITICAL RULES — follow exactly:
1. ONLY recommend products from the list below. NEVER invent or mention products not in this list.
2. NEVER recommend a product unless it clearly matches the customer's request.
3. If the list says "No products found", tell the customer politely and suggest they try different search terms.
4. If products are marked as fallback/general recommendations, tell the customer these are popular products that may interest them, since no exact match was found.
5. Always mention price and stock status for recommended products.
6. Be concise, friendly, and helpful.
7. Never discuss topics unrelated to shopping.
8. The store has ${totalProducts} total products — never say there are only a few products.

Products retrieved for this query (use ONLY these):
${productContext}`;

  // ── Build message history ─────────────────────────────────────────────────
  const messages = [
    { role: "system", content: systemContent },
    ...history.slice(-6).map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.text,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 512,
    temperature: 0.3,
  });

  return completion.choices[0].message.content;
};
