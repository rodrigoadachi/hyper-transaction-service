type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface CreateAppConfig {
  baseUrl: string;
  cookieKey?: string;
}

export interface GetOptions {
  params?: Record<string, unknown>;
  props?: Record<string, unknown>;
}

export interface MutationOptions {
  body?: unknown;
  props?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface DeleteOptions {
  props?: Record<string, unknown>;
}

interface InternalOptions {
  params?: Record<string, unknown>;
  props?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ErrorResponsePayload {
  message?: string | string[];
  error?: string;
}

const resolvePath = (path: string, props?: Record<string, unknown>): string => {
  if (!props) return path;
  return Object.entries(props).reduce<string>(
    (acc, [key, value]) => acc.replace(`{${key}}`, encodeURIComponent(String(value))),
    path,
  );
};

const clearAuthCookie = (cookieKey: string): void => {
  // biome-ignore lint/suspicious/noDocumentCookie: intentional cookie management for auth
  document.cookie = `${cookieKey}=; path=/; max-age=0; SameSite=Lax`;
};

const isTokenExpiredMessage = (errorData: ErrorResponsePayload): boolean => {
  const parts: string[] = [];

  if (typeof errorData.message === 'string') parts.push(errorData.message);
  if (Array.isArray(errorData.message)) parts.push(...errorData.message);
  if (typeof errorData.error === 'string') parts.push(errorData.error);

  const normalized = parts.join(' ').toLowerCase();

  return (
    normalized.includes('token expir')
    || normalized.includes('jwt expir')
    || normalized.includes('expired token')
  );
};

export const createApp = ({ baseUrl, cookieKey }: CreateAppConfig) => {
  const request = async <T>(
    method: HttpMethod,
    path: string,
    options: InternalOptions = {},
  ): Promise<T> => {
    const resolvedPath = resolvePath(path, options.props);
    const url = new URL(`${baseUrl}${resolvedPath}`, window.location.origin);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    if (cookieKey) {
      const match = document.cookie.match(new RegExp(`(^| )${cookieKey}=([^;]+)`));
      if (match?.[2]) {
        headers.set('Authorization', `Bearer ${match[2]}`);
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as ErrorResponsePayload;
      const shouldForceLogout =
        cookieKey !== undefined
        && (response.status === 401 || isTokenExpiredMessage(errorData));

      if (shouldForceLogout) {
        clearAuthCookie(cookieKey);
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }

      if (typeof errorData.message === 'string') {
        throw new Error(errorData.message);
      }

      if (Array.isArray(errorData.message)) {
        throw new Error(errorData.message.join(', '));
      }

      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  };

  return {
    get: <T>(path: string, options?: GetOptions) =>
      request<T>('GET', path, options),

    post: <T>(path: string, options?: MutationOptions) =>
      request<T>('POST', path, options),

    put: <T>(path: string, options?: MutationOptions) =>
      request<T>('PUT', path, options),

    delete: <T>(path: string, options?: DeleteOptions) =>
      request<T>('DELETE', path, options),
  };
};