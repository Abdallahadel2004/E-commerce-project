import express from 'express';
import {
  getPromos,
  getPromo,
  createPromo,
  updatePromo,
  deletePromo,
  validatePromo
} from '../controllers/promoController.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public route
router.post('/validate', validatePromo);

// Admin only routes
router.get('/', auth, authorize('admin'), getPromos);
router.get('/:id', auth, authorize('admin'), getPromo);
router.post('/', auth, authorize('admin'), createPromo);
router.put('/:id', auth, authorize('admin'), updatePromo);
router.delete('/:id', auth, authorize('admin'), deletePromo);

export default router;
