import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getProductRecommendations,
  getCrossSellSuggestions,
  chatbotQuery,
  getSalesAnalysis,
  generateProductDescription,
  generateMarketingContent,
  getCustomerInsights
} from '../controllers/ai.controller';

const router = Router();

// Public routes
router.post('/chat', chatbotQuery);
router.get('/products/recommendations', authenticate, getProductRecommendations);
router.get('/products/:productId/cross-sell', getCrossSellSuggestions);

// Protected AI features
router.use(authenticate);

// Admin AI features
router.get('/analytics/sales', authorize(['ADMIN', 'SUPER_ADMIN']), getSalesAnalysis);
router.get('/insights/customers', authorize(['ADMIN', 'SUPER_ADMIN']), getCustomerInsights);
router.post('/content/product-description', authorize(['ADMIN', 'SUPER_ADMIN']), generateProductDescription);
router.post('/content/marketing', authorize(['ADMIN', 'SUPER_ADMIN']), generateMarketingContent);

export default router;
