import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      clientID:
        configService.get<string>('GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(
        new UnauthorizedException('Google account has no email address'),
        false
      );
    }

    const user = await this.authService.validateOAuthUser('google', {
      providerId: profile.id,
      email,
      username: profile.displayName || undefined,
      avatarUrl: profile.photos?.[0]?.value,
    });

    done(null, user);
  }
}
