import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getDashboardAnalytics,
  getRevenueReport,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllOrders,
  updateOrderStatus,
  assignDistributor,
  getSettings,
  updateSetting
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['ADMIN', 'SUPER_ADMIN']));

// Dashboard & Analytics
router.get('/dashboard', getDashboardAnalytics);
router.get('/reports/revenue', getRevenueReport);

// User Management
router.get('/users', getAllUsers);
router.put('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);

// Order Management
router.get('/orders', getAllOrders);
router.put('/orders/:orderId/status', updateOrderStatus);
router.post('/orders/:orderId/assign-distributor', assignDistributor);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSetting);

export default router;
