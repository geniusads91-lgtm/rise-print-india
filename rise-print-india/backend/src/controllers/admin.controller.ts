import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get Dashboard Analytics
export const getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '7d' } = req.query;
    
    const daysMap: any = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[period as string] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get counts
    const [
      totalUsers,
      totalOrders,
      totalRevenue,
      pendingOrders,
      pendingPayments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.order.count({ where: { createdAt: { gte: startDate } } }),
      prisma.order.aggregate({
        where: { 
          createdAt: { gte: startDate },
          paymentStatus: 'PAID'
        },
        _sum: { totalAmount: true }
      }),
      prisma.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
      prisma.payment.count({ where: { paymentStatus: 'VERIFICATION_PENDING' } })
    ]);

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        distributor: { select: { businessName: true } }
      }
    });

    // Get top products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });

    const topProductDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, images: true, basePrice: true }
        });
        return { ...product, totalSold: item._sum.quantity };
      })
    );

    // District-wise distribution
    const districtStats = await prisma.district.findMany({
      include: {
        distributors: {
          select: { id: true, isActive: true }
        },
        orders: {
          where: { createdAt: { gte: startDate } },
          select: { id: true, totalAmount: true }
        }
      }
    });

    const districtData = districtStats.map(d => ({
      district: d.name,
      orders: d.orders.length,
      revenue: d.orders.reduce((sum, o) => sum + o.totalAmount, 0),
      distributors: d.distributors.filter(di => di.isActive).length
    })).sort((a, b) => b.orders - a.orders).slice(0, 10);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalOrders,
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          pendingOrders,
          pendingPayments
        },
        recentOrders,
        topProducts: topProductDetails,
        districtStats: districtData,
        period
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Revenue Reports
export const getRevenueReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, interval = 'day' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const revenueData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${interval}, "createdAt") as date,
        COUNT(*) as orderCount,
        SUM("totalAmount") as totalRevenue,
        AVG("totalAmount") as avgOrderValue
      FROM "Order"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND "paymentStatus" = 'PAID'
      GROUP BY DATE_TRUNC(${interval}, "createdAt")
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: { revenueData, startDate: start, endDate: end }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Users with Filters
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          walletBalance: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
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

// Update User Role
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['CUSTOMER', 'DISTRIBUTOR', 'DISTRICT_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: user
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete User
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Orders with Filters
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, districtId, distributorId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (districtId) where.districtId = districtId;
    if (distributorId) where.distributorId = distributorId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          district: { select: { name: true } },
          distributor: { select: { businessName: true } },
          items: { 
            take: 1,
            include: { product: { select: { name: true, images: true } } }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        orders,
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

// Update Order Status
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PRINTING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        user: { select: { email: true, phone: true } },
        distributor: { include: { user: { select: { email: true, phone: true } } } }
      }
    });

    // TODO: Send notifications to user and distributor

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign Distributor to Order
export const assignDistributor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { distributorId } = req.body;

    const distributor = await prisma.distributor.findUnique({
      where: { id: distributorId }
    });

    if (!distributor) {
      res.status(404).json({ success: false, message: 'Distributor not found' });
      return;
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { distributorId }
    });

    res.json({
      success: true,
      message: 'Distributor assigned successfully',
      data: order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get System Settings
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { group: 'asc' }
    });

    const groupedSettings = settings.reduce((acc: any, setting) => {
      if (!acc[setting.group]) acc[setting.group] = {};
      acc[setting.group][setting.key] = setting.value;
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedSettings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Setting
export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, type } = req.body;

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value, type: type || 'STRING' },
      create: {
        key,
        value,
        type: type || 'STRING',
        label: key
      }
    });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: setting
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
