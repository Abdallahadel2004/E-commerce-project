import express from 'express';
import {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    addImages,
    getUserProducts,
    getLowStockProducts,
    searchProducts,
} from '../controllers/productController.js';
import { adminOnly, auth, authorize } from '../middleware/auth.middleware.js'; // Changed from 'protect' to 'auth'
import Product from '../models/product.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/:id', getProduct);

router.get('/user/me', auth, getUserProducts);

router.post('/', auth, adminOnly, createProduct);
router.put('/:id', auth, authorize(Product), updateProduct);
router.delete('/:id', auth, authorize(Product), deleteProduct);
router.post('/:id/images', auth, authorize(Product), addImages);
router.get('/admin/low-stock', auth, adminOnly, getLowStockProducts);

export default router;
