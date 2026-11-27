import "dotenv/config";
import { z } from "zod";

const optionalSetting = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);
const optionalMailFrom = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional().refine((value) => {
    if (!value) return true;
    const address = value.match(/<([^<>]+)>$/)?.[1] ?? value;
    return z.string().email().safeParse(address.trim()).success;
  }, "MAIL_FROM must be an email address or a display name with an email address")
);

// Environment schema validation
const envSchema = z.object({
  ORACLE_USER: z.string().min(1).optional(),
  ORACLE_PASSWORD: z.string().min(1).optional(),
  ORACLE_CONNECT_STRING: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().min(1).optional(),
  DB_CONNECT_STRING: z.string().min(1).optional(),
  DB_CONNECTION_STRING: z.string().min(1).optional(),
  ORACLE_POOL_MIN: z.coerce.number().default(2),
  ORACLE_POOL_MAX: z.coerce.number().default(10),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),

  CORS_ORIGINS: z.string().default("*"),
  PORT: z.coerce.number().default(3000),
  SMTP_HOST: optionalSetting,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: optionalSetting,
  SMTP_PASSWORD: optionalSetting,
  MAIL_FROM: optionalMailFrom,
  APP_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional().refine((value) => {
      if (!value) return true;
      return ["http:", "https:"].includes(new URL(value).protocol);
    }, "APP_BASE_URL must use HTTP or HTTPS")
  ),
  BLOOD_ALERT_RADIUS_KM: z.coerce.number().min(0.1).max(500).default(50),
  BLOOD_ALERT_MAX_RECIPIENTS: z.coerce.number().int().min(1).max(100).default(25),
});

// Type inferred from the schema
export type EnvConfig = z.infer<typeof envSchema>;

// Validate and load environment variables
const env = envSchema.parse(process.env);

const normalizedEnv = {
  ...env,
  ORACLE_USER: env.ORACLE_USER ?? env.DB_USER,
  ORACLE_PASSWORD: env.ORACLE_PASSWORD ?? env.DB_PASSWORD,
  ORACLE_CONNECT_STRING: env.ORACLE_CONNECT_STRING ?? env.DB_CONNECT_STRING ?? env.DB_CONNECTION_STRING,
};

export default normalizedEnv;
export { envSchema, normalizedEnv as env };