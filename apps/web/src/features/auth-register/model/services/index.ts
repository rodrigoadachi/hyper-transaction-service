import { publicApi } from '../../../../lib/api';
import type { RegisterData, RegisterPayload } from '../types';

export const registerService = (payload: RegisterPayload): Promise<RegisterData> =>
  publicApi
    .post<{ data: RegisterData }>('/auth/register', { body: payload })
    .then((res) => res.data);
