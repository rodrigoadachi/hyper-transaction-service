import { api } from '../../../../lib/api';
import type { TransactionsPage } from '../types';

export const getDashboardStats = (): Promise<TransactionsPage> =>
  api.get<TransactionsPage>('/transactions', { params: { page: '1', limit: '100' } });

export const getDashboardRecent = (): Promise<TransactionsPage> =>
  api.get<TransactionsPage>('/transactions', { params: { page: '1', limit: '5' } });
