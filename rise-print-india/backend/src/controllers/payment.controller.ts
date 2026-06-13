import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Generate QR Code Data for UPI Payment
export const generateQRCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, orderId, userId } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid amount' });
      return;
    }

    // UPI payment URL format
    const upiId = process.env.UPI_ID || 'riseprintindia@oksbi';
    const transactionId = `RPI${Date.now()}`;
    
    const qrData = `upi://pay?pa=${upiId}&pn=Rise Print India&am=${amount}&tid=${transactionId}&cu=INR`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        orderId: orderId || null,
        amount,
        paymentMethod: 'QR_CODE',
        paymentStatus: 'PENDING',
        transactionId,
        qrCodeData: qrData
      }
    });

    res.json({
      success: true,
      message: 'QR Code generated successfully',
      data: {
        paymentId: payment.id,
        transactionId,
        qrCodeData,
        upiId,
        amount,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Payment Screenshot
export const uploadPaymentScreenshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!paymentId) {
      res.status(400).json({ success: false, message: 'Payment ID required' });
      return;
    }

    // In production, handle file upload with multer
    const screenshotUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        screenshotUrl,
        paymentStatus: 'VERIFICATION_PENDING'
      }
    });

    res.json({
      success: true,
      message: 'Payment screenshot uploaded successfully. Awaiting verification.',
      data: payment
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Payment (Admin only)
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { verified, remarks } = req.body;
    const adminId = (req as any).user?.userId;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true }
    });

    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    if (verified) {
      // Update payment status
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: 'PAID',
          verifiedBy: adminId,
          verifiedAt: new Date(),
          remarks: remarks || 'Payment verified successfully'
        }
      });

      // Update order status if exists
      if (payment.orderId) {
        await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED'
          }
        });

        // Create invoice
        const invoiceNumber = `INV${Date.now()}`;
        await prisma.invoice.create({
          data: {
            invoiceNumber,
            orderId: payment.orderId,
            amount: payment.amount,
            totalAmount: payment.amount,
            issuedAt: new Date()
          }
        });
      }

      // Credit wallet if needed
      if (payment.paymentMethod === 'WALLET') {
        await prisma.user.update({
          where: { id: payment.userId },
          data: { walletBalance: { decrement: payment.amount } }
        });

        await prisma.walletTransaction.create({
          data: {
            userId: payment.userId,
            type: 'DEBIT',
            amount: payment.amount,
            balance: 0, // Will be calculated properly
            description: `Payment for order ${payment.orderId}`,
            referenceType: 'ORDER',
            referenceId: payment.orderId
          }
        });
      }
    } else {
      // Reject payment
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: 'FAILED',
          verifiedBy: adminId,
          verifiedAt: new Date(),
          failureReason: remarks || 'Payment verification failed'
        }
      });
    }

    res.json({
      success: true,
      message: `Payment ${verified ? 'approved' : 'rejected'} successfully`,
      data: { paymentId, status: verified ? 'PAID' : 'FAILED' }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Payments
export const getUserPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const payments = await prisma.payment.findMany({
      where: { userId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true
          }
        }
      }
    });

    const total = await prisma.payment.count({ where: { userId } });

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          total
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Payment Details
export const getPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Initiate Refund
export const initiateRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    const userId = (req as any).user?.userId;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true }
    });

    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    if (payment.paymentStatus !== 'PAID') {
      res.status(400).json({ 
        success: false, 
        message: 'Only paid payments can be refunded' 
      });
      return;
    }

    const refundAmount = amount || payment.amount;

    // Process refund to wallet
    await prisma.walletTransaction.create({
      data: {
        userId: payment.userId,
        type: 'CREDIT',
        amount: refundAmount,
        balance: refundAmount,
        description: `Refund: ${reason || 'Order cancellation'}`,
        referenceType: 'REFUND',
        referenceId: paymentId
      }
    });

    await prisma.user.update({
      where: { id: payment.userId },
      data: { walletBalance: { increment: refundAmount } }
    });

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        paymentStatus: 'REFUNDED',
        refundAmount,
        refundedAt: new Date(),
        remarks: reason
      }
    });

    if (payment.orderId) {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'REFUNDED',
          paymentStatus: 'REFUNDED'
        }
      });
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { refundAmount, newWalletBalance: refundAmount }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Pending Payments for Verification (Admin)
export const getPendingPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const payments = await prisma.payment.findMany({
      where: { paymentStatus: 'VERIFICATION_PENDING' },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        order: {
          select: {
            orderNumber: true,
            totalAmount: true
          }
        }
      }
    });

    const total = await prisma.payment.count({
      where: { paymentStatus: 'VERIFICATION_PENDING' }
    });

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          total
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
