import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { prisma } from '../index';

const router = Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, asyncHandler(async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      addresses: true,
      orders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, images: true },
              },
            },
          },
        },
      },
    },
  });

  res.json({ success: true, user });
}));

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, asyncHandler(async (req: any, res) => {
  const { firstName, lastName, avatar } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { firstName, lastName, avatar },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      avatar: true,
    },
  });

  res.json({ success: true, user });
}));

// @route   GET /api/users/addresses
// @desc    Get user addresses
// @access  Private
router.get('/addresses', authenticate, asyncHandler(async (req: any, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: { isDefault: 'desc' },
  });

  res.json({ success: true, addresses });
}));

// @route   POST /api/users/addresses
// @desc    Add new address
// @access  Private
router.post('/addresses', authenticate, asyncHandler(async (req: any, res) => {
  const { addressType, street, landmark, city, district, state, pincode, latitude, longitude } = req.body;

  // If this is set as default, unset other defaults
  if (req.body.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId: req.user.id,
      addressType,
      street,
      landmark,
      city,
      district,
      state: state || 'Uttar Pradesh',
      pincode,
      isDefault: req.body.isDefault || false,
      latitude,
      longitude,
    },
  });

  res.status(201).json({ success: true, address });
}));

// @route   PUT /api/users/addresses/:id
// @desc    Update address
// @access  Private
router.put('/addresses/:id', authenticate, asyncHandler(async (req: any, res) => {
  const { id } = req.params;
  const { isDefault, ...updateData } = req.body;

  const address = await prisma.address.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updatedAddress = await prisma.address.update({
    where: { id },
    data: updateData,
  });

  res.json({ success: true, address: updatedAddress });
}));

// @route   DELETE /api/users/addresses/:id
// @desc    Delete address
// @access  Private
router.delete('/addresses/:id', authenticate, asyncHandler(async (req: any, res) => {
  const { id } = req.params;

  const address = await prisma.address.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  await prisma.address.delete({ where: { id } });

  res.json({ success: true, message: 'Address deleted successfully' });
}));

// @route   GET /api/users/wallet
// @desc    Get wallet balance and transactions
// @access  Private
router.get('/wallet', authenticate, asyncHandler(async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { walletBalance: true },
  });

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  res.json({
    success: true,
    wallet: {
      balance: user?.walletBalance || 0,
      transactions,
    },
  });
}));

// @route   GET /api/users/orders
// @desc    Get user orders
// @access  Private
router.get('/orders', authenticate, asyncHandler(async (req: any, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const where: any = { userId: req.user.id };
  if (status) {
    where.status = status;
  }

  const orders = await prisma.order.findMany({
    where,
    skip: (parseInt(page) - 1) * parseInt(limit),
    take: parseInt(limit),
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, images: true, slug: true },
          },
        },
      },
      district: { select: { name: true } },
      distributor: {
        select: {
          businessName: true,
          user: { select: { phone: true } },
        },
      },
    },
  });

  const total = await prisma.order.count({ where });

  res.json({
    success: true,
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

export default router;
