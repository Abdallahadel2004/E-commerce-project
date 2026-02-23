import express from 'express';
import {
    getPromos,
    getPromo,
    createPromo,
    updatePromo,
    deletePromo,
    validatePromo,
} from '../controllers/promoController.js';
import { adminOnly, auth, authorize } from '../middleware/auth.middleware.js';
import PromoCode from '../models/promo_code.model.js';

const router = express.Router();

router.post('/validate', validatePromo);
router.use(auth, adminOnly);
router.get('/', getPromos);
router.get('/:id', getPromo);
router.post('/', createPromo);
router.put('/:id', updatePromo);
router.delete('/:id', deletePromo);

export default router;
