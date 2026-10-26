import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'transitops-jwt-secure-secret-key-2026';

export interface AuthPayload {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  fullName: string;
  isDemoAccount: boolean;
  avatarUrl?: string;
}

export function generateJwtToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwtToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
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

  // 3. Fallback to session cookie transitops_user (email) for backward compatibility
  const userEmail = req.cookies?.transitops_user || req.headers['x-user-email'];
  if (userEmail) {
    return {
      id: 'usr-manager-01',
      email: String(userEmail),
      role: 'fleet_manager',
      tenantId: 'demo_tenant',
      fullName: 'Alex Morgan',
      isDemoAccount: true,
    };
  }

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ detail: 'Authentication required. Please sign in.' });
  }
  (req as any).user = user;
  next();
}
