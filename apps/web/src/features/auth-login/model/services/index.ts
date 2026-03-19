import { publicApi } from '../../../../lib/api';
import type { LoginData, LoginPayload } from '../types';

export const loginService = (payload: LoginPayload): Promise<LoginData> =>
  publicApi
    .post<{ data: LoginData }>('/auth/login', { body: payload })
    .then((res) => res.data);
