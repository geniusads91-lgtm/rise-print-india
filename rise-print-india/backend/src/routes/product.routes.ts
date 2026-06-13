import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { prisma } from '../index';

const router = Router();

// @route   GET /api/products
// @desc    Get all products with filters
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { category, search, minPrice, maxPrice, page = 1, limit = 12, featured, sort } = req.query;

  const where: any = { isActive: true };

  if (category) {
    where.categoryId = category as string;
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
      { tags: { has: search as string } },
    ];
  }

  if (minPrice || maxPrice) {
    where.basePrice = {};
    if (minPrice) where.basePrice.gte = parseFloat(minPrice as string);
    if (maxPrice) where.basePrice.lte = parseFloat(maxPrice as string);
  }

  if (featured === 'true') {
    where.isFeatured = true;
  }

  const orderBy: any = { createdAt: 'desc' };
  if (sort === 'price-asc') orderBy.basePrice = 'asc';
  if (sort === 'price-desc') orderBy.basePrice = 'desc';
  if (sort === 'popular') orderBy.totalSales = 'desc';
  if (sort === 'rating') orderBy.rating = 'desc';

  const products = await prisma.product.findMany({
    where,
    skip: (parseInt(page as string) - 1) * parseInt(limit as string),
    take: parseInt(limit as string),
    orderBy,
    include: {
      category: { select: { name: true, slug: true } },
    },
  });

  const total = await prisma.product.count({ where });

  res.json({
    success: true,
    products,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

// @route   GET /api/products/:slug
// @desc    Get single product by slug
// @access  Public
router.get('/:slug', asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: {
      category: true,
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
        },
      },
    },
  });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Increment views (analytics)
  await prisma.analytics.create({
    data: {
      type: 'PRODUCT_VIEW',
      productId: product.id,
      data: { slug: product.slug },
    },
  });

  res.json({ success: true, product });
}));

// @route   GET /api/products/categories
// @desc    Get all categories
// @access  Public
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { products: true } },
      children: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ success: true, categories });
}));

export default router;
