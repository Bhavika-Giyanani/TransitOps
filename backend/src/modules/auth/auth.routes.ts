import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../db';
import { generateJwtToken, extractAuthUser } from '../../middleware/auth';
import { ensureDriverProfile } from '../drivers/driverAccounts';

export const authRouter = Router();

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required.'),
});

authRouter.post('/login', async (req: Request, res: Response) => {
  // Validate request body with Zod
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((e) => e.message).join(' ');
    return res.status(400).json({ detail: errorMsg, errors: validation.error.flatten().fieldErrors });
  }

  const { email, password } = validation.data;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(503).json({ detail: 'Authentication is not configured on this server.' });
  }
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ detail: 'Invalid credentials. Please verify your email and password.' });
  }

  if (user.isDemoAccount) {
    const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
    if (!demoPassword) {
      return res.status(503).json({ detail: 'Demo sign-in is not configured on this server.' });
    }
    if (password !== demoPassword) {
      return res.status(401).json({ detail: 'Invalid credentials. Use the password configured for demo accounts.' });
    }
  } else {
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ detail: 'Invalid credentials. Please verify your password.' });
    }
  }

  if (!await ensureDriverProfile(user)) {
    return res.status(409).json({
      detail: 'Your driver account is missing valid mobile, licence, category, or expiry details. Ask your organization administrator to update your profile.',
    });
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    fullName: user.fullName,
    isDemoAccount: user.isDemoAccount,
    avatarUrl: user.avatarUrl || undefined,
  };

  const token = generateJwtToken(tokenPayload);

  res.cookie('transitops_jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });
  return res.json({
    ...tokenPayload,
    token,
  });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const authUser = extractAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ detail: 'Session expired or invalid.' });
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: authUser.id, tenantId: authUser.tenantId },
  });

  if (!dbUser) {
    return res.status(401).json({ detail: 'User account not found.' });
  }
  if (!await ensureDriverProfile(dbUser)) {
    return res.status(409).json({
      detail: 'Your driver account is missing valid mobile, licence, category, or expiry details. Ask your organization administrator to update your profile.',
    });
  }

  return res.json({
    id: dbUser.id,
    fullName: dbUser.fullName,
    email: dbUser.email,
    role: dbUser.role,
    tenantId: dbUser.tenantId,
    isDemoAccount: dbUser.isDemoAccount,
    avatarUrl: dbUser.avatarUrl,
  });
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('transitops_jwt');
  return res.status(204).end();
});
