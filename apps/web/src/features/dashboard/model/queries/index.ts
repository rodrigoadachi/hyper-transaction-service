import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TransactionsPage } from '../types';
import { Auth } from '../../../../lib/auth';
import { getDashboardRecent, getDashboardStats } from '../services';

const auth = new Auth();

export const useDashboardStatsQuery = (): UseQueryResult<TransactionsPage> =>
  useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    enabled: auth.isAuthenticated,
  });

export const useDashboardRecentQuery = (): UseQueryResult<TransactionsPage> =>
  useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: getDashboardRecent,
    enabled: auth.isAuthenticated,
  });
