import express from 'express';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

export const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send({
        message: 'welcome to our website',
    });
});

app.get('/home', (req, res) => {
    res.send({
        message: 'welcome to home our website',
    });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/cart', cartRoutes);
app.use('/product', productRoutes);
app.use('/category', categoryRoutes);
app.use('/orders', orderRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/reviews', reviewRoutes);
app.use('/payment', paymentRoutes);

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(
            'Server is running on port 3000, click here: http://localhost:' +
                PORT
        );
    });
};

startServer();
