import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get Product Recommendations for User
export const getProductRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { limit = 10 } = req.query;

    // Get user's order history
    const userOrders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: { select: { productId: true } }
      }
    });

    const purchasedProductIds = userOrders.flatMap(o => o.items.map(i => i.productId));

    // Get products from same categories
    if (purchasedProductIds.length > 0) {
      const purchasedProducts = await prisma.product.findMany({
        where: { id: { in: purchasedProductIds } },
        select: { categoryId: true }
      });

      const categoryIds = [...new Set(purchasedProducts.map(p => p.categoryId))];

      const recommendations = await prisma.product.findMany({
        where: {
          categoryId: { in: categoryIds },
          id: { notIn: purchasedProductIds },
          isActive: true
        },
        take: Number(limit),
        orderBy: { totalSales: 'desc' },
        include: {
          category: { select: { name: true, slug: true } }
        }
      });

      res.json({
        success: true,
        data: {
          recommendations,
          reason: 'Based on your purchase history'
        }
      });
    } else {
      // New user - return featured products
      const recommendations = await prisma.product.findMany({
        where: { isFeatured: true, isActive: true },
        take: Number(limit),
        include: {
          category: { select: { name: true, slug: true } }
        }
      });

      res.json({
        success: true,
        data: {
          recommendations,
          reason: 'Featured products'
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Cross-sell Suggestions
export const getCrossSellSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true }
    });

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    // Get products from same category or related tags
    const suggestions = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: productId },
        isActive: true
      },
      take: 5,
      orderBy: { rating: 'desc' },
      include: {
        category: { select: { name: true } }
      }
    });

    res.json({
      success: true,
      data: {
        productId,
        suggestions,
        reason: 'Similar products'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// AI Chatbot - Handle Customer Queries
export const chatbotQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, context } = req.body;

    if (!query) {
      res.status(400).json({ success: false, message: 'Query is required' });
      return;
    }

    const lowerQuery = query.toLowerCase();
    let response = '';
    let data: any = null;

    // Order status queries
    if (lowerQuery.includes('order status') || lowerQuery.includes('track order')) {
      response = 'To track your order, please provide your order number. You can find it in your order confirmation email or SMS.';
    }
    // Product information
    else if (lowerQuery.includes('product') || lowerQuery.includes('printing')) {
      const products = await prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        take: 5,
        select: { id: true, name: true, basePrice: true, images: true }
      });
      response = 'Here are our popular printing products:';
      data = { products };
    }
    // Pricing queries
    else if (lowerQuery.includes('price') || lowerQuery.includes('cost')) {
      response = 'Our pricing varies based on quantity, product type, and customization. Please browse our products or contact us for a custom quote.';
    }
    // Distributor information
    else if (lowerQuery.includes('distributor') || lowerQuery.includes('contact')) {
      response = 'We have distributors across all 75 districts of Uttar Pradesh. Please provide your district to find your nearest distributor.';
    }
    // FAQ handling
    else if (lowerQuery.includes('delivery') || lowerQuery.includes('shipping')) {
      response = 'Standard delivery takes 5-7 business days. Free shipping on orders above ₹1000. Express delivery available for additional charges.';
    }
    else if (lowerQuery.includes('payment')) {
      response = 'We accept UPI, QR Code payments, Bank Transfer, and Wallet payments. All payments are secure and verified.';
    }
    else if (lowerQuery.includes('return') || lowerQuery.includes('refund')) {
      response = 'We offer refunds for cancelled orders. Refunds are processed to your wallet within 24 hours of cancellation.';
    }
    else {
      response = 'Hello! I\'m here to help you with your printing needs. You can ask me about:\n- Order tracking\n- Product information\n- Pricing\n- Delivery\n- Payments\n- Returns & Refunds';
    }

    // Log the interaction
    await prisma.aILog.create({
      data: {
        type: 'CHATBOT',
        input: { query, context },
        output: { response, data },
        latency: 50
      }
    });

    res.json({
      success: true,
      data: {
        query,
        response,
        data,
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sales Analysis & Forecasting
export const getSalesAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '30d' } = req.query;
    
    const daysMap: any = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[period as string] || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get daily sales data
    const dailySales = await prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*) as orderCount,
        SUM("totalAmount") as revenue
      FROM "Order"
      WHERE "createdAt" >= ${startDate} AND "paymentStatus" = 'PAID'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Calculate metrics
    const totalRevenue = dailySales.reduce((sum: any, day: any) => sum + parseFloat(day.revenue || 0), 0);
    const totalOrders = dailySales.reduce((sum: any, day: any) => sum + parseInt(day.orderCount || 0), 0);
    const avgDailyRevenue = totalRevenue / (dailySales.length || 1);
    const avgOrderValue = totalRevenue / (totalOrders || 1);

    // Simple forecasting (linear projection)
    const projectedRevenue = avgDailyRevenue * 30; // Next 30 days
    const projectedOrders = Math.round((totalOrders / days) * 30);

    // Growth rate
    const firstHalf = dailySales.slice(0, Math.floor(dailySales.length / 2));
    const secondHalf = dailySales.slice(Math.floor(dailySales.length / 2));
    
    const firstHalfRevenue = firstHalf.reduce((sum: any, day: any) => sum + parseFloat(day.revenue || 0), 0);
    const secondHalfRevenue = secondHalf.reduce((sum: any, day: any) => sum + parseFloat(day.revenue || 0), 0);
    
    const growthRate = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        period,
        metrics: {
          totalRevenue,
          totalOrders,
          avgDailyRevenue,
          avgOrderValue
        },
        forecast: {
          projectedRevenue,
          projectedOrders,
          growthRate: growthRate.toFixed(2)
        },
        dailySales
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate Product Description (AI Content)
export const generateProductDescription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productName, category, features } = req.body;

    if (!productName) {
      res.status(400).json({ success: false, message: 'Product name is required' });
      return;
    }

    // Template-based description generation
    const description = `Premium ${productName} - High-quality ${category.toLowerCase()} printing solution perfect for your business needs.
    
Key Features:
${features ? features.map((f: string) => `• ${f}`).join('\n') : '• Professional finish\n• Durable material\n• Fast turnaround'}

Ideal for businesses, events, and promotional activities. Customizable options available. Bulk ordering discounts applicable.`;

    const seoTitle = `${productName} - Premium ${category} Printing | Rise Print India`;
    const seoDescription = `Order high-quality ${productName} online. Best prices in Uttar Pradesh. Fast delivery, bulk discounts available.`;

    res.json({
      success: true,
      data: {
        productName,
        description,
        seoTitle,
        seoDescription,
        keywords: [productName, category, 'printing', 'custom', 'bulk']
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate Marketing Content
export const generateMarketingContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, topic, tone = 'professional' } = req.body;

    let content = '';
    let title = '';

    if (type === 'banner') {
      title = 'Special Offer Banner';
      content = `🎉 Limited Time Offer!\nGet Premium Printing Services at Unbeatable Prices\n✓ Visiting Cards | ✓ Banners | ✓ Brochures\n📞 Order Now: [Phone]\n🌐 Visit: www.riseprintindia.com`;
    } else if (type === 'blog') {
      title = `The Ultimate Guide to ${topic || 'Professional Printing'}`;
      content = `# ${title}\n\nIn today's competitive business landscape, professional printing services play a crucial role...\n\n## Why Choose Quality Printing?\n\nQuality printing makes a lasting impression...`;
    } else if (type === 'social_media') {
      title = 'Social Media Post';
      content = `🚀 Elevate your brand with premium printing solutions!\n\n✨ Visiting Cards | Banners | Brochures | Stickers\n💯 Quality Guaranteed | 📦 Fast Delivery\n\n#RisePrintIndia #PrintingServices #BusinessGrowth #UPBusiness`;
    }

    res.json({
      success: true,
      data: {
        type,
        title,
        content,
        tone,
        suggestions: [
          'Add compelling visuals',
          'Include call-to-action',
          'Highlight unique selling points',
          'Use urgency elements'
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Customer Insights
export const getCustomerInsights = async (req: Request, res: Response): Promise<void> => {
  try {
    const { segment = 'all' } = req.query;

    const where: any = {};
    if (segment === 'active') {
      where.orders = { some: {} };
    }

    const customerStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
      _sum: { walletBalance: true },
      where
    });

    const topCustomers = await prisma.user.findMany({
      include: {
        orders: {
          select: { totalAmount: true },
          where: { paymentStatus: 'PAID' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const topCustomersWithSpending = topCustomers.map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      totalSpent: c.orders.reduce((sum, o) => sum + o.totalAmount, 0),
      orderCount: c.orders.length
    })).sort((a, b) => b.totalSpent - a.totalSpent);

    res.json({
      success: true,
      data: {
        segment,
        customerStats,
        topCustomers: topCustomersWithSpending.slice(0, 10),
        insights: {
          totalCustomers: customerStats.reduce((sum, s) => sum + s._count.id, 0),
          avgWalletBalance: customerStats[0]?._sum.walletBalance ? 
            customerStats[0]._sum.walletBalance! / customerStats.length : 0
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
