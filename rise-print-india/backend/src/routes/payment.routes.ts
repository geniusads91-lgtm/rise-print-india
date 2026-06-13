import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  generateQRCode,
  uploadPaymentScreenshot,
  verifyPayment,
  getUserPayments,
  getPaymentById,
  initiateRefund,
  getPendingPayments
} from '../controllers/payment.controller';

const router = Router();

// Public routes
router.post('/generate-qr', generateQRCode);

// Protected user routes
router.use(authenticate);
router.get('/', getUserPayments);
router.get('/:id', getPaymentById);
router.post('/upload-screenshot', uploadPaymentScreenshot);
router.post('/:paymentId/refund', initiateRefund);

// Admin routes
router.get('/pending/verify', authorize(['ADMIN', 'SUPER_ADMIN']), getPendingPayments);
router.post('/:paymentId/verify', authorize(['ADMIN', 'SUPER_ADMIN']), verifyPayment);

export default router;
