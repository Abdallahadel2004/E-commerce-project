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
    searchProducts
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/:id', getProduct);
router.use(protect);
router.get('/user/me', getUserProducts);
router.post('/', authorize('admin'), createProduct);
router.put('/:id', authorize('admin'), updateProduct);
router.delete('/:id', authorize('admin'), deleteProduct);
router.post('/:id/images', authorize('admin'), addImages);
router.get('/admin/low-stock', authorize('admin'), getLowStockProducts);
export default router;
