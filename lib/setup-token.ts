export function isSetupTokenValid(providedToken: string) {
  const setupToken = process.env.AUTH_SETUP_TOKEN;
  if (!setupToken || !providedToken || providedToken !== setupToken) return false;

  const expiresAt = process.env.AUTH_SETUP_TOKEN_EXPIRES_AT;
  if (!expiresAt) return true;

  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return false;

  return Date.now() <= expiry;
}
