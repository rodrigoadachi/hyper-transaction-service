import { api } from '../../../../lib/api';
import type { LoginData, LoginPayload } from '../types';

export const loginService = (payload: LoginPayload): Promise<LoginData> =>
  api
    .post<{ data: LoginData }>('/auth/login', { body: payload })
    .then((res) => res.data);
