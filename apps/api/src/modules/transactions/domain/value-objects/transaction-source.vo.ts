export const TransactionSource = {
  WEBHOOK: 'WEBHOOK',
  MANUAL: 'MANUAL',
} as const;

export type TransactionSource = (typeof TransactionSource)[keyof typeof TransactionSource];
