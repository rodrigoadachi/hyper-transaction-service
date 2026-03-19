import { z } from 'zod';

export const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const).optional(),
  source: z.enum(['WEBHOOK', 'MANUAL'] as const).optional(),
});

export type ListTransactionsDto = z.infer<typeof listTransactionsSchema>;
