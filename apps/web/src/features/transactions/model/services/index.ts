import { api } from '../../../../lib/api';
import type { CreateTransactionRequest, CreateTransactionResponse, TransactionsPage } from '../types';

export const getTransactionsService = (page: number, limit = 20): Promise<TransactionsPage> =>
  api.get<TransactionsPage>('/transactions', {
    params: { page: String(page), limit: String(limit) },
  });

export const createTransactionService = (
  request: CreateTransactionRequest,
): Promise<CreateTransactionResponse> =>
  api.post<CreateTransactionResponse>('/transactions', {
    body: request.payload,
    headers: { 'X-Idempotency-Key': request.idempotencyKey },
  });
