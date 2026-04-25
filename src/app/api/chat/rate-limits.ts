// app/api/chat/rate-limit.ts
interface RateLimitInfo {
  count: number;
  firstRequest: number;
}

const rateLimitMap = new Map<string, RateLimitInfo>();
const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 10; // 10 requests por minuto

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limitInfo = rateLimitMap.get(ip);

  if (!limitInfo) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  // Limpiar requests antiguos
  if (now - limitInfo.firstRequest > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (limitInfo.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  limitInfo.count++;
  return { allowed: true, remaining: MAX_REQUESTS - limitInfo.count };
}