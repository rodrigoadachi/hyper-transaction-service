export const TransactionType = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];
