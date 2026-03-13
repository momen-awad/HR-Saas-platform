import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development','production','test','staging']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('hr-saas-platform'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('v1'),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  DATABASE_SSL: z.string().transform(v => v === 'true').default(false),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().min(32),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string,unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.flatten();
    const errorMessages = Object.entries(formatted.fieldErrors)
      .map(([field, errors]) => `  ${field}: ${errors?.join(', ')}`)
      .join('\n');
    throw new Error(`\n❌ Environment validation failed:\n${errorMessages}\n`);
  }
  return result.data;
}
