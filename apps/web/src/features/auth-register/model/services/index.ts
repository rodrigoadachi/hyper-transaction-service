import { api } from '../../../../lib/api';
import type { RegisterData, RegisterPayload } from '../types';

export const registerService = (payload: RegisterPayload): Promise<RegisterData> =>
  api
    .post<{ data: RegisterData }>('/auth/register', { body: payload })
    .then((res) => res.data);
