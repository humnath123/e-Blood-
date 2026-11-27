// Simple logger utility - avoids logging sensitive data like passwords/tokens
const levels = {
  info: (message: string, meta?: unknown) => {
    console.info(`[INFO] ${message}`, meta ?? "");
  },
  error: (message: string, meta?: unknown) => {
    console.error(`[ERROR] ${message}`, meta ?? "");
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(`[WARN] ${message}`, meta ?? "");
  },
};

export default {
  info: levels.info,
  error: levels.error,
  warn: levels.warn,
};

// Convenience function to sanitize objects by removing known sensitive keys
export function sanitizeObject(obj: Record<string, any>, sensitiveKeys: Set<string> = new Set(["password", "token", "refreshToken"])): Record<string, any> {
  if (!obj || typeof obj !== "object") return obj;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.has(key)) {
      sanitized[key] = "[Redacted]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value, sensitiveKeys);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}