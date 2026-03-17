import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  
  // ECDSA P-256 keys — PKCS8/SPKI PEM encoded as base64 single-line (env safe)
  JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY must be provided'),
  JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY must be provided'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  PEPPER: z.string().min(32, 'PEPPER must be at least 32 characters'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  
  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST must be provided'),
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER must be provided'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD must be provided'),
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB must be provided'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Environment validation failed:\n${result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return result.data;
}
