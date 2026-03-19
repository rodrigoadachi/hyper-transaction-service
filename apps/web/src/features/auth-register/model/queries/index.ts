import { useMutation } from '@tanstack/react-query';
import type { RegisterPayload } from '../types';
import { registerService } from '../services';

export const useRegisterMutate = () =>
  useMutation({
    mutationFn: (payload: RegisterPayload) => registerService(payload),
  });
