import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// All 75 districts of Uttar Pradesh
const UP_DISTRICTS = [
  { name: 'Agra', code: 'UP-AG' },
  { name: 'Aligarh', code: 'UP-AL' },
  { name: 'Ambedkar Nagar', code: 'UP-AN' },
  { name: 'Amethi', code: 'UP-AM' },
  { name: 'Amroha', code: 'UP-AR' },
  { name: 'Auraiya', code: 'UP-AU' },
  { name: 'Ayodhya', code: 'UP-AY' },
  { name: 'Azamgarh', code: 'UP-AZ' },
  { name: 'Baghpat', code: 'UP-BG' },
  { name: 'Bahraich', code: 'UP-BH' },
  { name: 'Ballia', code: 'UP-BL' },
  { name: 'Balrampur', code: 'UP-BR' },
  { name: 'Banda', code: 'UP-BN' },
  { name: 'Barabanki', code: 'UP-BB' },
  { name: 'Bareilly', code: 'UP-BY' },
  { name: 'Basti', code: 'UP-BS' },
  { name: 'Bhadohi', code: 'UP-BD' },
  { name: 'Bijnor', code: 'UP-BJ' },
  { name: 'Budaun', code: 'UP-BU' },
  { name: 'Bulandshahr', code: 'UP-BSH' },
  { name: 'Chandauli', code: 'UP-CD' },
  { name: 'Chitrakoot', code: 'UP-CT' },
  { name: 'Deoria', code: 'UP-DE' },
  { name: 'Etah', code: 'UP-ET' },
  { name: 'Etawah', code: 'UP-EW' },
  { name: 'Farrukhabad', code: 'UP-FR' },
  { name: 'Fatehpur', code: 'UP-FT' },
  { name: 'Firozabad', code: 'UP-FZ' },
  { name: 'Gautam Buddha Nagar', code: 'UP-GB' },
  { name: 'Ghaziabad', code: 'UP-GZ' },
  { name: 'Ghazipur', code: 'UP-GP' },
  { name: 'Gonda', code: 'UP-GN' },
  { name: 'Gorakhpur', code: 'UP-GK' },
  { name: 'Hamirpur', code: 'UP-HM' },
  { name: 'Hapur', code: 'UP-HP' },
  { name: 'Hardoi', code: 'UP-HD' },
  { name: 'Hathras', code: 'UP-HT' },
  { name: 'Jalaun', code: 'UP-JL' },
  { name: 'Jaunpur', code: 'UP-JP' },
  { name: 'Jhansi', code: 'UP-JH' },
  { name: 'Kannauj', code: 'UP-KJ' },
  { name: 'Kanpur Dehat', code: 'UP-KD' },
  { name: 'Kanpur Nagar', code: 'UP-KN' },
  { name: 'Kasganj', code: 'UP-KS' },
  { name: 'Kaushambi', code: 'UP-KM' },
  { name: 'Kheri', code: 'UP-KH' },
  { name: 'Kushinagar', code: 'UP-KU' },
  { name: 'Lalitpur', code: 'UP-LA' },
  { name: 'Lucknow', code: 'UP-LK' },
  { name: 'Maharajganj', code: 'UP-MG' },
  { name: 'Mahoba', code: 'UP-MH' },
  { name: 'Mainpuri', code: 'UP-MP' },
  { name: 'Mathura', code: 'UP-MT' },
  { name: 'Mau', code: 'UP-MA' },
  { name: 'Meerut', code: 'UP-ME' },
  { name: 'Mirzapur', code: 'UP-MI' },
  { name: 'Moradabad', code: 'UP-MO' },
  { name: 'Muzaffarnagar', code: 'UP-MZ' },
  { name: 'Pilibhit', code: 'UP-PI' },
  { name: 'Pratapgarh', code: 'UP-PR' },
  { name: 'Prayagraj', code: 'UP-PY' },
  { name: 'Raebareli', code: 'UP-RA' },
  { name: 'Rampur', code: 'UP-RP' },
  { name: 'Saharanpur', code: 'UP-SA' },
  { name: 'Sambhal', code: 'UP-SM' },
  { name: 'Sant Kabir Nagar', code: 'UP-SK' },
  { name: 'Shahjahanpur', code: 'UP-SJ' },
  { name: 'Shamli', code: 'UP-SL' },
  { name: 'Shravasti', code: 'UP-SV' },
  { name: 'Siddharthnagar', code: 'UP-SD' },
  { name: 'Sitapur', code: 'UP-ST' },
  { name: 'Sonbhadra', code: 'UP-SO' },
  { name: 'Sultanpur', code: 'UP-SU' },
  { name: 'Unnao', code: 'UP-UN' },
  { name: 'Varanasi', code: 'UP-VA' }
];

// Seed districts (Admin only)
router.post('/seed', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const created = [];
    
    for (const district of UP_DISTRICTS) {
      const existing = await prisma.district.findUnique({
        where: { code: district.code }
      });
      
      if (!existing) {
        const d = await prisma.district.create({
          data: district
        });
        created.push(d);
      }
    }

    res.json({
      success: true,
      message: `Districts seeded successfully. Created ${created.length} new districts.`,
      data: { total: UP_DISTRICTS.length, created: created.length }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all districts
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    const where: any = {};
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const districts = await prisma.district.findMany({
      where,
      include: {
        distributors: {
          select: { id: true, businessName: true, isActive: true }
        },
        manager: {
          include: {
            user: {
              select: { firstName: true, lastName: true, phone: true }
            }
          }
        },
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: districts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get district by ID or name
router.get('/:idOrName', async (req, res) => {
  try {
    const { idOrName } = req.params;

    const district = await prisma.district.findFirst({
      where: { OR: [{ id: idOrName }, { name: idOrName }, { code: idOrName }] },
      include: {
        distributors: {
          where: { isActive: true, isVerified: true },
          include: {
            user: {
              select: { firstName: true, lastName: true, phone: true }
            }
          }
        },
        manager: {
          include: {
            user: {
              select: { firstName: true, lastName: true, phone: true, email: true }
            }
          }
        },
        orders: {
          select: { id: true, status: true, totalAmount: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!district) {
      res.status(404).json({ success: false, message: 'District not found' });
      return;
    }

    res.json({
      success: true,
      data: district
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create district (Admin)
router.post('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { name, code, state = 'Uttar Pradesh' } = req.body;

    const district = await prisma.district.create({
      data: { name, code, state }
    });

    res.status(201).json({
      success: true,
      message: 'District created successfully',
      data: district
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update district (Admin)
router.put('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, isActive } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code;
    if (isActive !== undefined) updateData.isActive = isActive;

    const district = await prisma.district.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'District updated successfully',
      data: district
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign District Manager
router.put('/:id/manager', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'DISTRICT_MANAGER' }
    });

    const districtManager = await prisma.districtManager.upsert({
      where: { districtId: id },
      update: { userId },
      create: { userId, districtId: id }
    });

    res.json({
      success: true,
      message: 'District manager assigned successfully',
      data: districtManager
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get district statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const district = await prisma.district.findUnique({
      where: { id },
      include: {
        distributors: {
          select: { id: true, isActive: true, isVerified: true }
        },
        orders: {
          select: { id: true, status: true, totalAmount: true, createdAt: true }
        }
      }
    });

    if (!district) {
      res.status(404).json({ success: false, message: 'District not found' });
      return;
    }

    const activeDistributors = district.distributors.filter(d => d.isActive && d.isVerified).length;
    const totalOrders = district.orders.length;
    const totalRevenue = district.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const pendingOrders = district.orders.filter(o => o.status === 'PENDING').length;

    res.json({
      success: true,
      data: {
        district: district.name,
        metrics: {
          activeDistributors,
          totalDistributors: district.distributors.length,
          totalOrders,
          totalRevenue,
          pendingOrders
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
