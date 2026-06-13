import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// Get all distributors (Admin)
router.get('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { districtId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (districtId) where.districtId = districtId as string;

    const [distributors, total] = await Promise.all([
      prisma.distributor.findMany({
        where,
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
          district: { select: { name: true } },
          orders: {
            select: { id: true, status: true, totalAmount: true },
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.distributor.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        distributors,
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
});

// Create distributor (Admin)
router.post('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const {
      userId,
      districtId,
      businessName,
      gstNumber,
      commissionRate,
      bankAccount,
      ifscCode,
      accountHolder,
      serviceAreas
    } = req.body;

    const distributor = await prisma.distributor.create({
      data: {
        userId,
        districtId,
        businessName,
        gstNumber: gstNumber || null,
        commissionRate: commissionRate || 5.0,
        bankAccount: bankAccount || null,
        ifscCode: ifscCode || null,
        accountHolder: accountHolder || null,
        serviceAreas: serviceAreas || []
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        district: true
      }
    });

    // Update user role to DISTRIBUTOR
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'DISTRIBUTOR' }
    });

    res.status(201).json({
      success: true,
      message: 'Distributor created successfully',
      data: distributor
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get distributor by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;

    const distributor = await prisma.distributor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            avatar: true
          }
        },
        district: true,
        orders: {
          include: {
            user: {
              select: { firstName: true, lastName: true, phone: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!distributor) {
      res.status(404).json({ success: false, message: 'Distributor not found' });
      return;
    }

    // Check access
    if (
      userRole !== 'ADMIN' &&
      userRole !== 'SUPER_ADMIN' &&
      distributor.userId !== (req as any).user?.userId
    ) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({
      success: true,
      data: distributor
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update distributor (Admin or own profile)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.userId;

    const distributor = await prisma.distributor.findUnique({
      where: { id }
    });

    if (!distributor) {
      res.status(404).json({ success: false, message: 'Distributor not found' });
      return;
    }

    // Check access
    if (
      userRole !== 'ADMIN' &&
      userRole !== 'SUPER_ADMIN' &&
      distributor.userId !== userId
    ) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updateData: any = {};
    const allowedFields = ['businessName', 'gstNumber', 'commissionRate', 'bankAccount', 'ifscCode', 'accountHolder', 'serviceAreas'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedDistributor = await prisma.distributor.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        district: true
      }
    });

    res.json({
      success: true,
      message: 'Distributor updated successfully',
      data: updatedDistributor
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify distributor (Admin)
router.put('/:id/verify', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const distributor = await prisma.distributor.update({
      where: { id },
      data: { isVerified: isVerified !== false }
    });

    res.json({
      success: true,
      message: `Distributor ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: distributor
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Activate/Deactivate distributor (Admin)
router.put('/:id/status', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const distributor = await prisma.distributor.update({
      where: { id },
      data: { isActive: isActive !== false }
    });

    res.json({
      success: true,
      message: `Distributor ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: distributor
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get distributor earnings
router.get('/:id/earnings', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const distributor = await prisma.distributor.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            createdAt: { gte: start, lte: end },
            paymentStatus: 'PAID'
          },
          select: {
            id: true,
            totalAmount: true,
            createdAt: true
          }
        }
      }
    });

    if (!distributor) {
      res.status(404).json({ success: false, message: 'Distributor not found' });
      return;
    }

    const totalOrders = distributor.orders.length;
    const totalRevenue = distributor.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const commission = totalRevenue * (distributor.commissionRate / 100);

    res.json({
      success: true,
      data: {
        distributorId: id,
        period: { start, end },
        metrics: {
          totalOrders,
          totalRevenue,
          commissionRate: distributor.commissionRate,
          commissionEarned: commission
        },
        orders: distributor.orders
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete distributor (Admin)
router.delete('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.distributor.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Distributor deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
