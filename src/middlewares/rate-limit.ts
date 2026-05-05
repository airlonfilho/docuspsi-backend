import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

// Default config: 100 requests per 15 minutes per IP
const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitOptions {
  windowMs?: number; // milliseconds
  max?: number; // max requests per window
  keyGenerator?: (req: Request) => string;
  message?: string;
}

/**
 * Simple in-memory rate limiting middleware
 * For production, use redis-based rate limiting
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = options.max || DEFAULT_LIMIT;
  const keyGenerator = options.keyGenerator || ((req: Request) => req.ip || req.socket.remoteAddress || "unknown");
  const message = options.message || "Too many requests, please try again later";

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Clean up expired entries
    if (store[key] && store[key].resetTime < now) {
      delete store[key];
    }

    if (!store[key]) {
      store[key] = { count: 1, resetTime: now + windowMs };
      next();
      return;
    }

    store[key].count++;

    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      res.status(429).set("Retry-After", String(retryAfter)).json({
        error: "TooManyRequests",
        message,
        retryAfter,
      });
      return;
    }

    next();
  };
}

/**
 * Stricter rate limit for lead capture routes
 * 10 requests per 5 minutes per IP
 */
export const leadsCaptureRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: "Too many lead submissions from this IP. Please try again later.",
});

/**
 * Rate limit for public document acceptance.
 * 3 attempts per 24 hours per token and IP.
 */
export const documentAcceptanceRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req: Request) => {
    const token = req.params.publicToken || req.params.token || "unknown-token";
    const forwardedFor = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
    const ip = forwardedFor || req.ip || req.socket.remoteAddress || "unknown-ip";
    return `document-acceptance:${token}:${ip}`;
  },
  message: "Limite de tentativas de aceite excedido. Tente novamente mais tarde.",
});

/**
 * Stricter rate limit for auth routes
 * 5 attempts per 15 minutes per email
 */
export function authRateLimit() {
  const store: { [email: string]: { count: number; resetTime: number } } = {};

  return (req: Request, res: Response, next: NextFunction) => {
    const email = req.body.email || "unknown";
    const now = Date.now();

    if (store[email] && store[email].resetTime < now) {
      delete store[email];
    }

    if (!store[email]) {
      store[email] = { count: 1, resetTime: now + 15 * 60 * 1000 };
      next();
      return;
    }

    store[email].count++;

    if (store[email].count > 5) {
      const retryAfter = Math.ceil((store[email].resetTime - now) / 1000);
      res.status(429).set("Retry-After", String(retryAfter)).json({
        error: "TooManyRequests",
        message: "Too many login attempts. Please try again later.",
        retryAfter,
      });
      return;
    }

    next();
  };
}
