import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AuditLogService,
  AuthService,
  AuthTokenResponseDto,
  ChangePasswordDto,
  DynamicRateLimit,
  FacebookAuthGuard,
  GoogleAuthGuard,
  JwtAuthGuard,
  LoginDto,
  MessageResponseDto,
  RegisterLocalDto,
  User,
  UserActionType,
  UserProfileResponseDto,
} from '@jt-workspace/nest-lib';
import { Idempotent } from '@nestjs/idempotency';

interface AuthenticatedRequest extends Request {
  user: User;
}

@ApiTags('Auth')
@DynamicRateLimit('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Version('1')
  @Post('register')
  @ApiOperation({
    summary: 'Register a local user',
    description:
      'Creates a new local user account and returns a JWT access token.',
  })
  @ApiBody({ type: RegisterLocalDto })
  @ApiResponse({
    status: 201,
    type: AuthTokenResponseDto,
    description: 'User registered and authenticated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(@Req() req: Request, @Body() body: RegisterLocalDto) {
    const result = await this.authService.registerLocal(body);
    await this.auditLogService.logFromRequest(
      req,
      result.user.id,
      UserActionType.REGISTER,
      { provider: result.user.provider },
    );
    return result;
  }

  @Version('1')
  @Post('login')
  @ApiOperation({
    summary: 'Login with email/username and password',
    description: 'Validates local credentials and returns a JWT access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    type: AuthTokenResponseDto,
    description: 'Authenticated successfully',
  })
  @ApiResponse({ status: 400, description: 'Malformed or unknown fields' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Req() req: Request, @Body() body: LoginDto) {
    const user = await this.authService.validateLocalUser(
      body.identifier,
      body.password,
    );
    const result = this.authService.login(user);
    await this.auditLogService.logFromRequest(
      req,
      user.id,
      UserActionType.LOGIN,
      { provider: user.provider },
    );
    return result;
  }

  @Version('1')
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({
    summary: 'Initiate Google OAuth2 login',
    description: 'Redirects the client to Google OAuth2 consent screen.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google OAuth2' })
  googleAuth() {
    return;
  }

  @Version('1')
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth2 callback',
    description:
      'Handles Google OAuth2 callback and issues a JWT access token.',
  })
  @ApiResponse({
    status: 200,
    type: AuthTokenResponseDto,
    description: 'Google OAuth2 login succeeded',
  })
  @ApiResponse({ status: 401, description: 'Google authentication failed' })
  async googleAuthCallback(@Req() req: AuthenticatedRequest) {
    const result = this.authService.login(req.user);
    await this.auditLogService.logFromRequest(
      req,
      req.user.id,
      UserActionType.LOGIN,
      { provider: 'google' },
    );
    return result;
  }

  @Version('1')
  @UseGuards(FacebookAuthGuard)
  @Get('facebook')
  @ApiOperation({
    summary: 'Initiate Facebook OAuth2 login',
    description: 'Redirects the client to Facebook OAuth2 consent screen.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Facebook OAuth2' })
  facebookAuth() {
    return;
  }

  @Version('1')
  @UseGuards(FacebookAuthGuard)
  @Get('facebook/callback')
  @ApiOperation({
    summary: 'Facebook OAuth2 callback',
    description:
      'Handles Facebook OAuth2 callback and issues a JWT access token.',
  })
  @ApiResponse({
    status: 200,
    type: AuthTokenResponseDto,
    description: 'Facebook OAuth2 login succeeded',
  })
  @ApiResponse({ status: 401, description: 'Facebook authentication failed' })
  async facebookAuthCallback(@Req() req: AuthenticatedRequest) {
    const result = this.authService.login(req.user);
    await this.auditLogService.logFromRequest(
      req,
      req.user.id,
      UserActionType.LOGIN,
      { provider: 'facebook' },
    );
    return result;
  }

  @Version('1')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({
    summary: 'Logout authenticated user',
    description: 'Records a LOGOUT audit event for the authenticated user.',
  })
  @ApiResponse({
    status: 201,
    type: MessageResponseDto,
    description: 'Logged out successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Req() req: AuthenticatedRequest) {
    await this.auditLogService.logFromRequest(
      req,
      req.user.id,
      UserActionType.LOGOUT,
    );
    return { success: true, message: 'Logged out successfully' };
  }

  @Version('1')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiOperation({
    summary: 'Change authenticated user password',
    description:
      'Verifies current password, updates password hash, and records audit log.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 201,
    type: MessageResponseDto,
    description: 'Password updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or wrong current password',
  })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
    await this.auditLogService.logFromRequest(
      req,
      req.user.id,
      UserActionType.CHANGE_PASSWORD,
    );
    return result;
  }

  @Version('1')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Idempotent({ required: true })
  @Get('me')
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description:
      'Returns the currently authenticated user extracted from the JWT token.',
  })
  @ApiResponse({
    status: 200,
    type: UserProfileResponseDto,
    description: 'Authenticated user profile',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
