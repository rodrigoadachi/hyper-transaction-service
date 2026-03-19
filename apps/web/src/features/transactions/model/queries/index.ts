import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { CreateTransactionPayload, CreateTransactionResponse, TransactionsPage } from '../types';
import { Auth } from '../../../../lib/auth';
import { createTransactionService, getTransactionsService } from '../services';

const auth = new Auth();

export const useTransactionsQuery = (page: number): UseQueryResult<TransactionsPage> =>
  useQuery({
    queryKey: ['transactions', page],
    queryFn: () => getTransactionsService(page),
    enabled: auth.isAuthenticated,
  });

export const useCreateTransactionMutate = (): UseMutationResult<
  CreateTransactionResponse,
  Error,
  CreateTransactionPayload
> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) => createTransactionService(payload),
    onSuccess: async () => await queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
};
