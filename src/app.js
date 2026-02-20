import express from 'express';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cartRoutes from './routes/cartRoutes.js';

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
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);

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
