// @Inject(AUTH_TOKENS.USER_REPOSITORY)
export const AUTH_TOKENS = {
  USER_REPOSITORY: Symbol('IUserRepository'),
  PASSWORD_HASHER: Symbol('IPasswordHasher'),
  TOKEN_SERVICE: Symbol('ITokenService'),
} as const;
