import express from 'express';
import {
    createOrder,
    getMyOrders,
    getOrder,
    updateOrderStatus,
    cancelOrder,
    getAllOrders,
    updatePaymentStatus,
} from '../controllers/orderController.js';
import { auth, authorize } from '../middleware/auth.middleware.js'; // Use auth directly
import Order from '../models/order.model.js';

const router = express.Router();
router.use(auth);
router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/:id', getOrder);
router.put('/:id/cancel', cancelOrder);
router.get('/', authorize(Order), getAllOrders);
router.put('/:id/status', authorize(Order), updateOrderStatus);
router.put('/:id/payment', authorize(Order), updatePaymentStatus);

export default router;
