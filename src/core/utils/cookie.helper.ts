import { Response } from 'express';

/**
 * Shared cookie configuration used across JwtAuthGuard, AuthController,
 * and any future code that sets auth cookies.
 *
 * Centralising here prevents drift between the guard (silent refresh)
 * and the controller (login/register).
 */

export const AUTH_COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  // Cross-origin (Vercel frontend → Render backend) requires SameSite=None + Secure.
  // In local dev (same-site) SameSite=Lax is fine and doesn't require HTTPS.
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
};

export const ACCESS_TOKEN_MAX_AGE  = 15 * 60 * 1000;           // 15 minutes
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;  // 7 days
export const RESET_TOKEN_MAX_AGE   = 10 * 60 * 1000;           // 10 minutes

/**
 * Set the accessToken and refreshToken cookies on the response.
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie('accessToken', accessToken, {
    ...AUTH_COOKIE_BASE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refreshToken', refreshToken, {
    ...AUTH_COOKIE_BASE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * Set the short-lived resetToken cookie used during OTP password reset.
 */
export function setResetCookie(res: Response, resetToken: string): void {
  res.cookie('resetToken', resetToken, {
    ...AUTH_COOKIE_BASE_OPTIONS,
    maxAge: RESET_TOKEN_MAX_AGE,
  });
}

/**
 * Clear all auth-related cookies (called on logout).
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie('accessToken',  { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

/**
 * Clear the reset token cookie after a successful password reset.
 */
export function clearResetCookie(res: Response): void {
  res.clearCookie('resetToken', { path: '/' });
}
