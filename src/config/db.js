import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('MONGO_URI or MONGODB_URI not set in environment');
        }

        // ─── FIX: In Mongoose 7+, conn.connection.db is not available immediately
        //          after connect() resolves — accessing it caused the crash.
        //          Use mongoose.connection directly instead, which is always safe.
        await mongoose.connect(mongoURI);

        const { host, name } = mongoose.connection;
        console.log(`✅ MongoDB Connected: ${host} — db: ${name}`);
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

export default connectDB;
