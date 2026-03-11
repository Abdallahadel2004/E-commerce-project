import express from 'express';
import {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    addImages,
    uploadProductImages,
    deleteProductImage,
    setPrimaryImage,
    getUserProducts,
    getLowStockProducts,
    searchProducts,
} from '../controllers/productController.js';
import { adminOnly, auth, authorize } from '../middleware/auth.middleware.js'; 
import Product from '../models/product.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/:id', getProduct);

router.get('/user/me', auth, getUserProducts);

router.post('/', auth, adminOnly, createProduct);
router.put('/:id', auth, authorize(Product), updateProduct);
router.delete('/:id', auth, authorize(Product), deleteProduct);
router.post('/:id/images', auth, authorize(Product), addImages);
router.post('/:id/upload', auth, authorize(Product), upload.array('images', 5), uploadProductImages);
router.delete('/:id/images/:imageId', auth, authorize(Product), deleteProductImage);
router.put('/:id/images/:imageId/primary', auth, authorize(Product), setPrimaryImage);
router.get('/admin/low-stock', auth, adminOnly, getLowStockProducts);

export default router;
