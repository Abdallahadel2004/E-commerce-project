import express from 'express';
import {
  addReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview
} from '../controllers/reviewController.js';
import { auth } from '../middleware/auth.middleware.js';
import { optionalAuth } from '../middleware/optionalAuth.js';   
const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.get('/my-reviews', auth, getMyReviews);
router.post('/', auth, addReview);
router.put('/:id', auth, updateReview);
router.delete('/:id', auth, deleteReview);

export default router;