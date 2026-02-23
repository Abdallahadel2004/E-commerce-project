import express from 'express';
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
} from '../controllers/wishlistController.js';
import { auth, authorize } from '../middleware/auth.middleware.js';
// import Wishlist from '../models/wishlist.js';

const router = express.Router();

router.use(auth);

router.get('/', getWishlist);
router.post('/add/:productId', addToWishlist);
router.delete('/remove/:productId', removeFromWishlist);
router.delete('/clear', clearWishlist);

export default router;
