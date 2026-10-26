import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { generateJwtToken, extractAuthUser } from '../middleware/auth';

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
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD || 'TransitOps@2026';

  let user = await prisma.user.findUnique({
    where: { email },
  });

  // If user doesn't exist, create an account on the fly for smooth demonstration
  if (!user) {
    const passwordHash = await bcrypt.hash(password || demoPassword, 10);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: email.split('@')[0],
        role: 'fleet_manager',
        tenantId: 'demo_tenant',
        isDemoAccount: false,
      },
    });
  } else {
    // Check credentials
    if (user.isDemoAccount) {
      // Demo accounts check password against .env DEMO_ACCOUNT_PASSWORD or stored hash
      const isDemoMatch = password === demoPassword;
      const isHashMatch = await bcrypt.compare(password, user.passwordHash).catch(() => false);
      if (!isDemoMatch && !isHashMatch) {
        return res.status(401).json({
          detail: 'Invalid credentials. For demo accounts, use the password configured in DEMO_ACCOUNT_PASSWORD or default.',
        });
      }
    } else {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ detail: 'Invalid credentials. Please verify your password.' });
      }
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

  // Set JWT cookie and backward-compatible transitops_user cookie
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
