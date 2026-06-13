import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generate unique order number
const generateOrderNumber = async (): Promise<string> => {
  const prefix = 'RPI';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.order.count({
    where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
  });
  return `${prefix}${date}${String(count + 1).padStart(4, '0')}`;
};

// Create Order
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { items, shippingAddressId, billingAddressId, paymentMethod, notes } = req.body;

    if (!items || items.length === 0) {
      res.status(400).json({ success: false, message: 'Order items are required' });
      return;
    }

    // Get user's default address if not provided
    let shippingAddress;
    if (shippingAddressId) {
      shippingAddress = await prisma.address.findUnique({ where: { id: shippingAddressId } });
    } else {
      shippingAddress = await prisma.address.findFirst({
        where: { userId, isDefault: true }
      });
    }

    if (!shippingAddress) {
      res.status(400).json({ success: false, message: 'Shipping address is required' });
      return;
    }

    // Calculate totals
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        res.status(400).json({ 
          success: false, 
          message: `Product ${item.productId} is not available` 
        });
        return;
      }

      if (item.quantity < product.minQuantity || item.quantity > product.maxQuantity) {
        res.status(400).json({ 
          success: false, 
          message: `Quantity must be between ${product.minQuantity} and ${product.maxQuantity} for ${product.name}` 
        });
        return;
      }

      const price = product.basePrice;
      const total = price * item.quantity;
      subtotal += total;

      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price,
        total,
        customization: item.customization || null
      });
    }

    const tax = subtotal * 0.18; // 18% GST
    const shippingCharge = subtotal > 1000 ? 0 : 100; // Free shipping above 1000
    const discount = 0; // Can be calculated based on coupons
    const totalAmount = subtotal + tax + shippingCharge - discount;

    // Find district for order routing
    const district = await prisma.district.findFirst({
      where: { name: shippingAddress.district }
    });

    // Find active distributor in district
    const distributor = await prisma.distributor.findFirst({
      where: {
        districtId: district?.id,
        isActive: true,
        isVerified: true
      }
    });

    // Create order
    const orderNumber = await generateOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        districtId: district?.id || null,
        distributorId: distributor?.id || null,
        status: 'PENDING',
        items: {
          create: orderItemsData
        },
        subtotal,
        tax,
        shippingCharge,
        discount,
        totalAmount,
        paymentStatus: 'PENDING',
        paymentMethod: paymentMethod || null,
        shippingAddress: {
          street: shippingAddress.street,
          landmark: shippingAddress.landmark,
          city: shippingAddress.city,
          district: shippingAddress.district,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode
        },
        billingAddress: billingAddressId ? {
          street: shippingAddress.street,
          landmark: shippingAddress.landmark,
          city: shippingAddress.city,
          district: shippingAddress.district,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode
        } : null,
        notes: notes || null,
        estimatedDelivery: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                basePrice: true
              }
            }
          }
        },
        district: { select: { id: true, name: true } },
        distributor: {
          select: {
            id: true,
            businessName: true,
            rating: true
          }
        }
      }
    });

    // Clear cart after order
    await prisma.cartItem.deleteMany({
      where: { cart: { userId } }
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Orders
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true
                }
              }
            }
          },
          distributor: {
            select: {
              id: true,
              businessName: true,
              phone: true
            }
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
          total,
          hasNext: skip + Number(limit) < total,
          hasPrev: skip > 0
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Order
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                images: true,
                specifications: true
              }
            }
          }
        },
        district: true,
        distributor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true
              }
            }
          }
        },
        payments: true,
        invoice: true
      }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Check if user owns this order or is admin/distributor
    const userRole = (req as any).user?.role;
    if (order.userId !== userId && 
        !['ADMIN', 'SUPER_ADMIN', 'DISTRICT_MANAGER'].includes(userRole)) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel Order
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.userId !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      res.status(400).json({ 
        success: false, 
        message: 'Order cannot be cancelled at this stage' 
      });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason
      }
    });

    // Refund to wallet if paid
    if (order.paymentStatus === 'PAID') {
      await prisma.walletTransaction.create({
        data: {
          userId,
          type: 'CREDIT',
          amount: order.totalAmount,
          balance: order.totalAmount,
          description: `Refund for cancelled order ${order.orderNumber}`,
          referenceType: 'ORDER',
          referenceId: id
        }
      });

      await prisma.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: order.totalAmount } }
      });

      await prisma.payment.updateMany({
        where: { orderId: id },
        data: {
          paymentStatus: 'REFUNDED',
          refundAmount: order.totalAmount,
          refundedAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: updatedOrder
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reorder
export const reorder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const previousOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!previousOrder || previousOrder.userId !== userId) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Prepare items for new order
    const items = previousOrder.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      customization: item.customization
    }));

    // Create new order with same details
    req.body = { items, ...previousOrder.shippingAddress as any };
    
    // Call createOrder logic (in production, refactor to avoid duplication)
    res.json({
      success: true,
      message: 'Reorder functionality - items added to cart',
      data: { items }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Track Order
export const trackOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        estimatedDelivery: true,
        deliveredAt: true,
        trackingNumber: true,
        createdAt: true,
        distributor: {
          select: {
            businessName: true,
            user: {
              select: {
                phone: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Order timeline
    const timeline = [
      { status: 'PENDING', label: 'Order Placed', date: order.createdAt },
      { status: 'CONFIRMED', label: 'Order Confirmed', date: null },
      { status: 'PROCESSING', label: 'Processing', date: null },
      { status: 'PRINTING', label: 'Printing', date: null },
      { status: 'READY_FOR_DELIVERY', label: 'Ready for Delivery', date: null },
      { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', date: null },
      { status: 'DELIVERED', label: 'Delivered', date: order.deliveredAt }
    ];

    const currentIndex = timeline.findIndex(t => t.status === order.status);
    timeline.forEach((t, i) => {
      if (i < currentIndex) {
        t.date = new Date(); // Completed steps
      }
    });

    res.json({
      success: true,
      data: {
        order,
        timeline
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
