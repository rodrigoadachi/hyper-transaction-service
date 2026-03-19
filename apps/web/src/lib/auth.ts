const COOKIE_KEY = 'hyper_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 1; // 1 day in seconds

export class Auth {
  get token(): string | null {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1] as string) : null;
  }

  get isAuthenticated(): boolean {
    return this.token !== null;
  }

  login(token: string): void {
    // biome-ignore lint/suspicious/noDocumentCookie: intentional cookie management for auth
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  logout(): void {
    // biome-ignore lint/suspicious/noDocumentCookie: intentional cookie management for auth
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}
