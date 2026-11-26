import "dotenv/config";
import { z } from "zod";

// Environment schema validation
const envSchema = z.object({
  ORACLE_USER: z.string().min(1).optional(),
  ORACLE_PASSWORD: z.string().min(1).optional(),
  ORACLE_CONNECT_STRING: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().min(1).optional(),
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
});

// Type inferred from the schema
export type EnvConfig = z.infer<typeof envSchema>;

// Validate and load environment variables
const env = envSchema.parse(process.env);

const normalizedEnv = {
  ...env,
  ORACLE_USER: env.ORACLE_USER ?? env.DB_USER,
  ORACLE_PASSWORD: env.ORACLE_PASSWORD ?? env.DB_PASSWORD,
  ORACLE_CONNECT_STRING: env.ORACLE_CONNECT_STRING ?? env.DB_CONNECTION_STRING,
};

export default normalizedEnv;
export { envSchema, normalizedEnv as env };