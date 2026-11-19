import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID:
        configService.get<string>('FACEBOOK_APP_ID') || 'not-configured',
      clientSecret:
        configService.get<string>('FACEBOOK_APP_SECRET') || 'not-configured',
      callbackURL:
        configService.get<string>('FACEBOOK_CALLBACK_URL') ||
        'http://localhost:3000/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'photos'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(
        new UnauthorizedException('Facebook account has no email address'),
        false,
      );
    }

    const fullName = [profile.name?.givenName, profile.name?.familyName]
      .filter(Boolean)
      .join(' ');

    const user = await this.authService.validateOAuthUser('facebook', {
      providerId: profile.id,
      email,
      username: fullName || profile.displayName || undefined,
      avatarUrl: profile.photos?.[0]?.value,
    });

    done(null, user);
  }
}
