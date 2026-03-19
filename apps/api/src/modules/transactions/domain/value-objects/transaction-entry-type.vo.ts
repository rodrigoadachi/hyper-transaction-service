export const TransactionEntryType = {
  PLATFORM_FEE: 'PLATFORM_FEE',
  TENANT_REVENUE: 'TENANT_REVENUE',
} as const;

export type TransactionEntryType = (typeof TransactionEntryType)[keyof typeof TransactionEntryType];
