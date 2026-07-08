import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from '../service/auth.service';
import { TokenService } from '../service/token.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  ChangePasswordDto,
  RequestOtpDto,
  VerifyOtpDto,
  ResetPasswordDto,
  WalletVerifyDto,
} from '../dto/auth.dto';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import {
  setAuthCookies,
  setResetCookie,
  clearAuthCookies,
  clearResetCookie,
} from '../../../core/utils/cookie.helper';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  // ─── Registration ────────────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: AuthResponseDto })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.register(dto);
    setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and clear authentication cookies' })
  logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const accessToken  = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    clearAuthCookies(res);
    return this.authService.logout(req.user.userId, accessToken, refreshToken);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  profile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  // ─── Change Password ─────────────────────────────────────────────────────

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
   * Step 1: verify email, send OTP, set resetToken cookie (otpVerified: false)
   */
  @Post('request-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset OTP sent to email' })
  async requestOtp(@Body() dto: RequestOtpDto, @Res({ passthrough: true }) res: Response) {
    const { resetToken } = await this.authService.requestPasswordReset(dto);
    setResetCookie(res, resetToken);
    return { message: 'OTP sent to your email' };
  }

  /**
   * POST /auth/verify-otp
   * Step 2: verify OTP from cookie userId, update resetToken (otpVerified: true)
   */
  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP for password reset' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resetToken = req.cookies?.resetToken;
    if (!resetToken) throw new UnauthorizedException('Reset session expired');

    const payload = this.tokenService.verifyResetToken(resetToken);
    if (!payload) throw new UnauthorizedException('Invalid or expired reset token');

    const { resetToken: newResetToken } = await this.authService.verifyOtp(payload.sub, dto.otp);
    setResetCookie(res, newResetToken);

    return { message: 'OTP verified successfully', verified: true };
  }

  /**
   * POST /auth/reset-password
   * Step 3: confirm otpVerified, set new password, clear resetToken cookie
   */
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using verified OTP session' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resetToken = req.cookies?.resetToken;
    if (!resetToken) throw new UnauthorizedException('Reset session expired');

    const payload = this.tokenService.verifyResetToken(resetToken);
    if (!payload || !payload.otpVerified) throw new UnauthorizedException('OTP verification required');

    const result = await this.authService.resetPassword(payload.sub, dto.newPassword);
    clearResetCookie(res);
    return result;
  }

  // ─── SIWE (Sign-In With Ethereum) ─────────────────────────────────────────

  /**
   * GET /auth/wallet/challenge?address=0xABC...
   * Step 1: Generate a nonce challenge message for the wallet to sign.
   * Client passes this message to MetaMask, gets a signature back.
   */
  @Get('wallet/challenge')
  @ApiOperation({ summary: 'Get a SIWE challenge message for a wallet address' })
  walletChallenge(@Query('address') address: string) {
    if (!address) throw new UnauthorizedException('Wallet address is required');
    return this.authService.generateWalletChallenge(address);
  }

  /**
   * POST /auth/wallet/verify
   * Step 2: Verify the wallet signature.
   * Auto-registers a new account if wallet is new, otherwise logs in.
   * Returns JWT pair in cookies + user object in body.
   */
  @Post('wallet/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify wallet signature — login or auto-register' })
  @ApiOkResponse({ type: AuthResponseDto })
  async walletVerify(
    @Body() dto: WalletVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.verifyWalletSignature(
      dto.address,
      dto.signature,
    );
    setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }
}
