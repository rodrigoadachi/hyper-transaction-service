import { createApp } from '@hyper/utils';

export const api = createApp({
  baseUrl: '/api',
  cookieKey: 'hyper_token',
});

export const publicApi = createApp({
  baseUrl: '/api',
});

