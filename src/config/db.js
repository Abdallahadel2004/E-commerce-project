import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not set in environment");
    }

    // ─── FIX: In Mongoose 7+, conn.connection.db is not available immediately
    //          after connect() resolves — accessing it caused the crash.
    //          Use mongoose.connection directly instead, which is always safe.
    await mongoose.connect(process.env.MONGODB_URI);

    const { host, name } = mongoose.connection;
    console.log(`✅ MongoDB Connected: ${host} — db: ${name}`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

export default connectDB;
