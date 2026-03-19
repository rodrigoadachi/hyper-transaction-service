import { useMutation } from '@tanstack/react-query';
import type { LoginPayload } from '../types';
import { loginService } from '../services';

export const useLoginMutate = () =>
  useMutation({
    mutationFn: (payload: LoginPayload) => loginService(payload),
  });
