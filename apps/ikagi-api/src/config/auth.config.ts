import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import type { AuthModuleAsyncOptions } from '@jt-workspace/nest-lib';

const DEFAULT_JWT_SECRET = 'dev_jwt_secret_change_in_prod';
const DEFAULT_JWT_EXPIRES_IN = '1d';

export const authConfig: AuthModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): JwtModuleOptions => ({
    secret: configService.get<string>('JWT_SECRET') || DEFAULT_JWT_SECRET,
    signOptions: {
      expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ||
        DEFAULT_JWT_EXPIRES_IN) as JwtSignOptions['expiresIn'],
    },
  }),
};
