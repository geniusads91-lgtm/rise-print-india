import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @route   POST /api/auth/register
// @desc    Register new customer
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { email, phone, password, firstName, lastName } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (existingUser) {
    throw new AppError('User already exists with this email or phone', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'CUSTOMER',
    },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  // Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    token,
    user,
  });
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().matches(/^[6-9]\d{9}$/),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { email, phone, password } = req.body;

  // Find user by email or phone
  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );

  // Save refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  res.json({
    success: true,
    message: 'Login successful',
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      walletBalance: user.walletBalance,
    },
  });
}));

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as any;

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  const newToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    token: newToken,
  });
}));

// @route   POST /api/auth/send-otp
// @desc    Send OTP for verification
// @access  Public
router.post('/send-otp', [
  body('phone').matches(/^[6-9]\d{9}$/),
], asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const otp = generateOTP();

  // Delete existing OTPs for this phone
  await prisma.OTP.deleteMany({
    where: { phone },
  });

  // Create new OTP
  await prisma.OTP.create({
    data: {
      phone,
      otp,
      purpose: 'LOGIN',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
  });

  // TODO: Send SMS via SMS gateway
  console.log(`OTP for ${phone}: ${otp}`);

  res.json({
    success: true,
    message: 'OTP sent successfully',
  });
}));

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/verify-otp', [
  body('phone').matches(/^[6-9]\d{9}$/),
  body('otp').length(6),
], asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  const otpRecord = await prisma.OTP.findFirst({
    where: {
      phone,
      otp,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otpRecord) {
    throw new AppError('Invalid or expired OTP', 400);
  }

  // Mark OTP as used
  await prisma.OTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  // Mark user as verified if exists
  await prisma.user.updateMany({
    where: { phone },
    data: { isVerified: true },
  });

  res.json({
    success: true,
    message: 'OTP verified successfully',
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, asyncHandler(async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      avatar: true,
      walletBalance: true,
      isVerified: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    user,
  });
}));

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, asyncHandler(async (req: any, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { refreshToken: null },
  });

  res.json({
    success: true,
    message: 'Logout successful',
  });
}));

export default router;
