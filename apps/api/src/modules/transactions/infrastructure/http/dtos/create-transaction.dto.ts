import { z } from 'zod';

export const createTransactionSchema = z.object({
  amountInCents: z
    .number()
    .int('amountInCents must be an integer')
    .positive('amountInCents must be a positive integer representing cents')
    .max(9_999_999_999, 'amountInCents exceeds maximum allowed value'),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code (e.g. BRL, USD)')
    .default('BRL'),
  source: z.enum(['WEBHOOK', 'MANUAL'] as const).default('MANUAL'),
  description: z.string().max(255).optional(),
  externalRef: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
