import express from 'express';
import {
    createCheckoutSession,
    success,
} from '../controllers/paymentController.js';

const router = express.Router();

router.use(auth);
router.post('/checkout/create/:orderId', createCheckoutSession);

router.get('/success', success);

// import bodyParser from 'body-parser';
import { auth } from '../middleware/auth.middleware.js';
// router.post('/webhook', bodyParser.raw({ type: 'application/json' }), webhook);

export default router;
