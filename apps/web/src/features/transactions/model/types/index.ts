import type { Transaction, TransactionsPage, PaginationMeta } from '../../../../lib/types';

export type { Transaction, TransactionsPage, PaginationMeta };

export type CreateTransactionPayload = {
  readonly amountInCents: number;
  readonly source?: string;
  readonly description?: string;
};

export type CreateTransactionResponse = {
  data: Transaction;
  cached?: boolean;
};
