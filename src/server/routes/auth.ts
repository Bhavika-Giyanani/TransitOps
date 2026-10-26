import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { generateJwtToken, extractAuthUser } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ detail: 'Email is required.' });
  }

  let user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
  });

  // If user doesn't exist, create an account on the fly for smooth demonstration
  if (!user) {
    const defaultPasswordHash = await bcrypt.hash(password || 'TransitOps@2026', 10);
    user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        passwordHash: defaultPasswordHash,
        fullName: String(email).split('@')[0],
        role: 'fleet_manager',
        tenantId: 'demo_tenant',
        isDemoAccount: false,
      },
    });
  } else if (password && user.passwordHash) {
    // Check password if provided and not a demo account bypass
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid && !user.isDemoAccount) {
      return res.status(401).json({ detail: 'Invalid credentials. Please verify your password.' });
    }
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

  // Set JWT cookie and backward compatible transitops_user cookie
  res.cookie('transitops_jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });
  res.cookie('transitops_user', user.email, {
    httpOnly: false,
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

  const dbUser = await prisma.user.findUnique({
    where: { email: authUser.email },
  });

  if (!dbUser) {
    return res.status(401).json({ detail: 'User account not found.' });
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
  res.clearCookie('transitops_user');
  return res.status(204).end();
});
