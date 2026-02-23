import express from 'express';
import {
    createOrder,
    getMyOrders,
    getOrder,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
    updatePaymentStatus,
} from '../controllers/orderController.js';
import { adminOnly, auth, authorize } from '../middleware/auth.middleware.js';
import Order from '../models/Order.js';

const router = express.Router();

router.use(auth);

router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/:id', authorize(Order), getOrder);
router.put('/:id/cancel', authorize(Order), cancelOrder);

router.get('/', adminOnly, getAllOrders);
router.put('/:id/status', authorize(Order), updateOrderStatus);
router.put('/:id/payment', authorize(Order), updatePaymentStatus);

export default router;
