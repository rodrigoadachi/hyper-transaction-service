export interface TokenPayload {
  sub: string; // UUIDv7
  email: string;
}

export interface AuthToken {
  accessToken: string;
  expiresIn: string;
}

export interface ITokenService {
  sign(payload: TokenPayload): AuthToken;
  verify(token: string): TokenPayload;
}
