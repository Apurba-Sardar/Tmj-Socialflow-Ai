import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { loadEnvironment } from '@socialflow/config';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from './types.js';

@Controller('auth')
export class AuthController {
  private readonly env = loadEnvironment();

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.register(dto);
    this.setAuthCookies(response, session);
    return { user: session.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto);
    this.setAuthCookies(response, session);
    return { user: session.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    const session = await this.authService.refresh(token ?? '');
    this.setAuthCookies(response, session);
    return { user: session.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(token);
    this.clearAuthCookies(response);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto);
    return { accepted: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return { user: await this.authService.verifyEmail(dto) };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  private setAuthCookies(
    response: Response,
    session: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date;
      refreshTokenExpiresAt: Date;
    },
  ): void {
    response.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
      httpOnly: true,
      secure: this.env.AUTH_COOKIE_SECURE,
      sameSite: 'lax',
      domain: this.env.AUTH_COOKIE_DOMAIN || undefined,
      expires: session.accessTokenExpiresAt,
      path: '/',
    });
    response.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: this.env.AUTH_COOKIE_SECURE,
      sameSite: 'lax',
      domain: this.env.AUTH_COOKIE_DOMAIN || undefined,
      expires: session.refreshTokenExpiresAt,
      path: '/api/auth',
    });
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
  }
}
