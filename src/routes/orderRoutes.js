import express from 'express';
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
  updatePaymentStatus
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');


router.use(protect);
router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/:id', getOrder);
router.put('/:id/cancel', cancelOrder);
router.get('/', authorize('admin'), getAllOrders);
router.put('/:id/status', authorize('admin'), updateOrderStatus);
router.put('/:id/payment', authorize('admin'), updatePaymentStatus);

export default router;