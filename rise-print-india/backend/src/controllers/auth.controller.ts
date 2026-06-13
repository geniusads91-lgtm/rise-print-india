import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'rise-print-india-secret-key-2024';

// Generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register User
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, password, firstName, lastName, role } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] }
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'User already exists with this email or phone' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        firstName,
        lastName: lastName || null,
        role: role || 'CUSTOMER'
      }
    });

    // Generate OTP for verification
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.oTP.create({
      data: {
        phone,
        otp,
        purpose: 'REGISTER',
        expiresAt: otpExpiresAt
      }
    });

    // Create wallet for user
    await prisma.walletTransaction.create({
      data: {
        userId: user.id,
        type: 'CREDIT',
        amount: 0,
        balance: 0,
        description: 'Wallet initialized'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your phone with OTP.',
      data: { userId: user.id, email: user.email, phone: user.phone }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login User
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, password } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] }
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update refresh token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          isVerified: user.isVerified,
          walletBalance: user.walletBalance
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send OTP
export const sendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, purpose } = req.body;

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate previous OTPs for this phone
    await prisma.oTP.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true }
    });

    // Create new OTP
    await prisma.oTP.create({
      data: {
        phone,
        otp,
        purpose: purpose || 'LOGIN',
        expiresAt
      }
    });

    // In production, send SMS here
    console.log(`OTP for ${phone}: ${otp} (Purpose: ${purpose})`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: { phone, expiresAt }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        phone,
        otp,
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpRecord) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      return;
    }

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true }
    });

    // If registration OTP, verify the user
    if (otpRecord.purpose === 'REGISTER') {
      await prisma.user.update({
        where: { phone },
        data: { isVerified: true }
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Refresh Token
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: { accessToken: newAccessToken }
    });
  } catch (error: any) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

// Logout
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null }
      });
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Current User Profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        distributorProfile: true,
        districtManagerProfile: {
          include: { district: true }
        }
      }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const { password, refreshToken, otp, ...userData } = user;

    res.json({
      success: true,
      data: userData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { firstName, lastName, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        avatar: avatar || undefined
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Change Password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
