import { api } from '../../../../lib/api';
import type { CreateTransactionPayload, CreateTransactionResponse, TransactionsPage } from '../types';

export const getTransactionsService = (page: number, limit = 20): Promise<TransactionsPage> =>
  api.get<TransactionsPage>('/transactions', {
    params: { page: String(page), limit: String(limit) },
  });

export const createTransactionService = (
  payload: CreateTransactionPayload,
): Promise<CreateTransactionResponse> =>
  api.post<CreateTransactionResponse>('/transactions', {
    body: payload,
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
  });
