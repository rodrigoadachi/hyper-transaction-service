export type { Transaction, TransactionsPage, PaginationMeta } from '../../../../lib/types';

export type DashboardStats = {
  total: number;
  volume: number;
  avgTicket: number;
  completed: number;
  failed: number;
  approvalRate: string;
};
