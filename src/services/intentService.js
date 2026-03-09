// services/intentService.js
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const analyzeIntent = async (message, history = []) => {
  const conversationContext =
    history.length > 0
      ? `\nRecent conversation:\n${history
          .slice(-4)
          .map((h) => `${h.role}: ${h.text}`)
          .join("\n")}`
      : "";

  const prompt = `You are an intent analyzer for an e-commerce store chatbot.
Analyze the user's message and respond ONLY with a valid JSON object.
${conversationContext}
User message: "${message}"

Respond ONLY with this JSON (no explanation, no markdown):
{
  "isProductSearch": true or false,
  "expandedQuery": "enriched search string with synonyms and related terms for semantic search. Empty string if not a product search.",
  "specificity": 0.0 to 1.0,
  "priceFilter": {
    "min": number or null,
    "max": number or null
  },
  "reasoning": "one sentence"
}

Rules:
- isProductSearch = true if user wants to find, buy, or learn about products
- expandedQuery must include synonyms to maximize semantic search coverage
- priceFilter.max: extract from phrases like "under $200", "less than 300", "below $500", "cheaper than 400"
- priceFilter.min: extract from phrases like "over $100", "more than 200", "above $50"
- priceFilter values should be plain numbers (no $ sign)
- If no price mentioned, set both to null
- Consider conversation history for context`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleaned);

    console.log(
      `🧠 Intent: ${result.isProductSearch ? "product search" : "conversation"} | specificity: ${result.specificity} | price: ${JSON.stringify(result.priceFilter)} | query: "${result.expandedQuery}"`,
    );

    return {
      isProductSearch: Boolean(result.isProductSearch),
      expandedQuery: result.expandedQuery || message,
      specificity: Math.max(0, Math.min(1, result.specificity || 0.5)),
      priceFilter: {
        min: result.priceFilter?.min ?? null,
        max: result.priceFilter?.max ?? null,
      },
      reasoning: result.reasoning || "",
    };
  } catch (err) {
    console.error("Intent analysis failed, using fallback:", err.message);
    return {
      isProductSearch: true,
      expandedQuery: message,
      specificity: 0.5,
      priceFilter: { min: null, max: null },
      reasoning: "fallback",
    };
  }
};

export const getThreshold = (specificity) => {
  const MIN_THRESHOLD = 0.5;
  const MAX_THRESHOLD = 0.75;
  return MIN_THRESHOLD + specificity * (MAX_THRESHOLD - MIN_THRESHOLD);
};
