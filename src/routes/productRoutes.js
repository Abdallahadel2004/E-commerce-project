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
import { auth, authorize } from '../middleware/auth.middleware.js'; // Changed from 'protect' to 'auth'

const router = express.Router();


router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/:id', getProduct);


router.get('/user/me', auth, getUserProducts); 

router.post('/', auth, authorize('admin'), createProduct); 
router.put('/:id', auth, authorize('admin'), updateProduct);
router.delete('/:id', auth, authorize('admin'), deleteProduct);
router.post('/:id/images', auth, authorize('admin'), addImages);
router.get('/admin/low-stock', auth, authorize('admin'), getLowStockProducts);

export default router;