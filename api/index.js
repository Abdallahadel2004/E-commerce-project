import app from "../src/app.js";
import connectDB from "../src/config/db.js";

// Ensure DB connects before processing request, though typically for serverless
// it connects gracefully or is awaited globally.
// This executes during the brief cold boot phase of Vercel serverless.
connectDB();

export default app;
