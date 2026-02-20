import express from 'express';
import {
  validatePromo,
  createPromo,
  getPromos,
  updatePromo,
  deletePromo
} from '../controllers/promoController.js';
import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/validate', validatePromo);
router.post('/', auth, authorize('admin'), createPromo);
router.get('/', auth, authorize('admin'), getPromos);
router.put('/:id', auth, authorize('admin'), updatePromo);
router.delete('/:id', auth, authorize('admin'), deletePromo);

export default router;