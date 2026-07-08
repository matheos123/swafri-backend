import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from '../service/auth.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  ChangePasswordDto,
  RequestOtpDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from '../dto/auth.dto';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';

/**
 * AuthController
 * 
 * HTTP layer for all authentication endpoints
 * 
 * Responsibilities:
 * - Route handling and HTTP request/response management
 * - Cookie management (setting and clearing JWT tokens)
 * - Request validation (handled by DTOs and ValidationPipe)
 * - Swagger documentation
 * 
 * Separation of Concerns:
 * - Delegates all business logic to AuthService
 * - Handles only HTTP concerns (cookies, status codes, routing)
 * - Does not contain any business logic
 * 
 * Cookie Strategy:
 * - accessToken: HTTP-only, 15 min expiry
 * - refreshToken: HTTP-only, 7 days expiry
 * - Both are secure in production, sameSite: lax for CSRF protection
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Cookie Management ───────────────────────────────────────────────────

  /**
   * Set JWT tokens as HTTP-only cookies on the response
   * 
   * HTTP-only cookies prevent client-side JavaScript from accessing tokens,
   * protecting against XSS attacks
   * 
   * @param res - Express response object
   * @param accessToken - JWT access token (15 min)
   * @param refreshToken - JWT refresh token (7 days)
   */
  private setCookies(res: Response, accessToken: string, refreshToken: string): void {
    const cookieOptions = {
      httpOnly: true,                                          // Prevents XSS attacks
      secure: process.env.NODE_ENV === 'production',          // HTTPS only in production
      sameSite: 'lax' as const,                               // CSRF protection
      path: '/',
    };

    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,           // 15 minutes in milliseconds
    });

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * POST /auth/register
   * 
   * Register a new user and set JWT cookies
   * Returns user data with tokens in both response body and cookies
   */
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthResponseDto })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  /**
   * POST /auth/login
   * 
   * Authenticate user with email/password and set JWT cookies
   * Returns user data with tokens in both response body and cookies
   */
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ─── Token Refresh ───────────────────────────────────────────────────────

  /**
   * POST /auth/refresh
   * 
   * Exchange refresh token for new access/refresh token pair
   * Reads refresh token from cookie first, falls back to request body
   * Sets new tokens as cookies on success
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const result = await this.authService.refresh(refreshToken);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  /**
   * POST /auth/logout
   * 
   * Revoke refresh token and clear JWT cookies
   * Requires valid access token (JWT guard)
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and clear authentication cookies' })
  logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    // Clear both cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return this.authService.logout(req.user.userId);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  /**
   * GET /auth/profile
   * 
   * Retrieve current user's profile
   * Requires valid access token (JWT guard)
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  profile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  // ─── Password Change ─────────────────────────────────────────────────────

  /**
   * POST /auth/change-password
   * 
   * Change password for authenticated user
   * Requires current password for verification
   * Requires valid access token (JWT guard)
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password for authenticated user' })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  // ─── OTP Password Reset Flow ──────────────────────────────────────────────

  /**
   * POST /auth/request-otp
   * 
   * Step 1 of password reset: Request OTP via email
   * Returns generic message regardless of email existence (prevents enumeration)
   */
  @Post('request-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset OTP sent to email' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestPasswordReset(dto);
  }

  /**
   * POST /auth/verify-otp
   * 
   * Step 2 of password reset: Verify the received OTP
   * Use this to validate OTP before showing the new password form
   */
  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP for password reset' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * POST /auth/reset-password
   * 
   * Step 3 of password reset: Set new password using valid OTP
   * OTP is cleared after successful reset
   */
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
