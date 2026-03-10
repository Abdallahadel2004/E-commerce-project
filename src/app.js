import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import promoRoutes from "./routes/promoRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js"; // ← NEW
import searchRoutes from "./routes/searchRoutes.js";
import compareRoutes from "./routes/compareRoutes.js";
import visualSearchRouter from "./routes/visualSearch.js";
import setupBuilderRoutes from "./routes/setupBuilderRoutes.js";
export const app = express();
export default app;

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:4200",
        "https://angular-pro-deploy.vercel.app",
        process.env.CLIENT_URL,
      ].filter(Boolean);

      // Allow requests with no origin (e.g. mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Check exact match first
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow all Vercel preview deployments for abdallahadel2004s-projects
      if (/^https:\/\/.*abdallahadel2004s-projects\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  })
);

app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send({ message: "welcome to our website" });
});

app.get("/home", (req, res) => {
  res.send({ message: "welcome to home our website" });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlists", wishlistRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/payment", paymentRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/chat", chatRoutes); // ← NEW
app.use("/api/search", searchRoutes);
app.use("/api/compare", compareRoutes);
app.use("/api/visual-search", visualSearchRouter);
app.use("/api/ai/setup-builder", setupBuilderRoutes);

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(
      "Server is running on port " +
        PORT +
        ", click here: http://localhost:" +
        PORT,
    );
  });

  // ─── Auto-embed any products added outside the API (e.g. via Compass) ────
  // Runs in background after server starts — never blocks startup
  setImmediate(async () => {
    try {
      const { default: Product } = await import("./models/product.js");
      const { embedProduct } = await import("./services/autoEmbedService.js");
      const { productToText } = await import("./services/embeddingService.js");

      const missing = await Product.find({
        embedding: { $exists: false },
        isActive: true,
        deletedAt: null,
      }).select("name description shortDescription seo");

      if (missing.length === 0) return;

      console.log(
        `🔄 Found ${missing.length} product(s) without embeddings — generating in background...`,
      );
      for (const product of missing) {
        await embedProduct(product);
      }
      console.log("✅ Background embedding complete.");
    } catch (err) {
      console.error("Background embedding error:", err.message);
    }
  });
};

// Only start the server when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  startServer();
}
