import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Simple in-memory login rate limiter.
 * Max 5 failed attempts per IP per 15 minutes.
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    if (val.resetAt < now) loginAttempts.delete(key);
  }
}, 10 * 60 * 1000);

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    const record = loginAttempts.get(ip);
    if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      throw new HttpException(
        `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  static recordFailure(ip: string) {
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (!record || record.resetAt < now) {
      loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      record.count++;
    }
  }

  static clearAttempts(ip: string) {
    loginAttempts.delete(ip);
  }
}
