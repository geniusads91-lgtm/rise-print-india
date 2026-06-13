import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  reorder,
  trackOrder
} from '../controllers/order.controller';

const router = Router();

// All routes are protected
router.use(authenticate);

// Order CRUD
router.post('/', createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);
router.get('/:id/track', trackOrder);

// Order actions
router.post('/:id/cancel', cancelOrder);
router.post('/:orderId/reorder', reorder);

export default router;
