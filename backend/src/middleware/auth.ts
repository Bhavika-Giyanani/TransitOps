import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

export interface AuthPayload {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  fullName: string;
  isDemoAccount: boolean;
  avatarUrl?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateJwtToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyJwtToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export function extractAuthUser(req: Request): AuthPayload | null {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyJwtToken(token);
    if (decoded) return decoded;
  }

  // 2. Check transitops_jwt cookie
  const cookieToken = req.cookies?.transitops_jwt;
  if (cookieToken) {
    const decoded = verifyJwtToken(cookieToken);
    if (decoded) return decoded;
  }

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ detail: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ detail: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
