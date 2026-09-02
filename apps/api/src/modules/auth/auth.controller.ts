import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PinUnlockDto, StudioLoginDto, StudioRegisterDto } from './dto/auth.dto';
import { AppConfigService } from '@/shared/config/app-config.service';
import { CurrentDevice } from '@/shared/auth/current-device.decorator';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser, DeviceContext } from '@/shared/auth/auth.types';
import { DeviceAuthGuard } from '@/shared/auth/device-auth.guard';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';

type CookieRequest = Request & { cookies?: unknown };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('studio/register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async studioRegister(
    @Body() dto: StudioRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.registerStudio({
      studioName: dto.studioName,
      email: dto.email,
      password: dto.password,
      responsibleCpf: dto.responsibleCpf,
      cnpj: dto.cnpj,
      subscriptionPlan: dto.subscriptionPlan,
      adminName: dto.adminName,
      adminPin: dto.adminPin,
      professionalName: dto.professionalName,
      professionalPin: dto.professionalPin,
      receptionName: dto.receptionName,
      receptionPin: dto.receptionPin,
      deviceName: dto.deviceName,
      userAgent: req.headers['user-agent'],
    });
    this.setCookie(res, 'device_token', result.deviceToken, result.expiresAt);
    this.setCookie(res, 'refresh_token', result.refreshToken, result.refreshExpiresAt);
    return { studio: result.studio, deviceExpiresAt: result.expiresAt, accessToken: result.accessToken, staff: result.staff };
  }

  @Post('studio/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async studioLogin(
    @Body() dto: StudioLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.studioLogin({
      email: dto.email,
      password: dto.password,
      deviceName: dto.deviceName,
      userAgent: req.headers['user-agent'],
    });
    this.setCookie(res, 'device_token', result.deviceToken, result.expiresAt);
    return { studio: result.studio, deviceExpiresAt: result.expiresAt };
  }

  @Get('device/status')
  @ApiCookieAuth('device_token')
  @UseGuards(DeviceAuthGuard)
  async deviceStatus(@CurrentDevice() device: DeviceContext) {
    return this.auth.deviceStatus(device.studioId, device.deviceSessionId);
  }

  @Post('pin/unlock')
  @ApiCookieAuth('device_token')
  @UseGuards(DeviceAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async unlock(
    @CurrentDevice() device: DeviceContext,
    @Body() dto: PinUnlockDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.unlockWithPin(device.studioId, device.deviceSessionId, dto.pin);
    this.setCookie(res, 'refresh_token', result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, staff: result.staff };
  }

  @Post('session/refresh')
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies;
    const refreshToken =
      cookies && typeof cookies === 'object' && 'refresh_token' in cookies
        ? (cookies as Record<'refresh_token', unknown>).refresh_token
        : undefined;
    const result = await this.auth.refresh(typeof refreshToken === 'string' ? refreshToken : '');
    this.setCookie(res, 'refresh_token', result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken };
  }

  @Post('session/lock')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async lock(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.lock(user.studioId, user.staffMemberId);
    res.clearCookie('refresh_token');
    return { locked: true };
  }

  @Post('studio/logout')
  @ApiCookieAuth('device_token')
  @UseGuards(DeviceAuthGuard)
  async logout(
    @CurrentDevice() device: DeviceContext,
    @Req() req: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.studioLogout(device.studioId, device.deviceSessionId, req.user?.staffMemberId);
    res.clearCookie('device_token');
    res.clearCookie('refresh_token');
    return { loggedOut: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.studioId, user.staffMemberId);
  }

  private setCookie(res: Response, name: string, value: string, expires: Date): void {
    res.cookie(name, value, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? 'none' : 'lax',
      domain: this.config.cookieDomain,
      expires,
      path: '/',
    });
  }
}
