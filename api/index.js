import { app } from "../src/app.js";
import connectDB from "../src/config/db.js";

export default async (req, res) => {
    try {
        await connectDB();
    } catch (err) {
        console.error("Database connection failed:", err);
        return res.status(500).json({
            success: false,
            message: "Database connection failed. Please check your Vercel Environment Variables."
        });
    }
    return app(req, res);
};
