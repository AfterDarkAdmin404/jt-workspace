import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

export interface AuthModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  inject?: any[];
  useFactory?: (...args: any[]) => Promise<JwtModuleOptions> | JwtModuleOptions;
}

@Module({})
export class AuthModule {
  static forRootAsync(options: AuthModuleAsyncOptions = {}): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      imports: [
        ConfigModule,
        PassportModule,
        TypeOrmModule.forFeature([User]),
        JwtModule.registerAsync({
          imports: options.imports ?? [ConfigModule],
          inject: options.inject ?? [ConfigService],
          useFactory:
            options.useFactory ??
            ((configService: ConfigService): JwtModuleOptions => ({
              secret:
                configService.get<string>('JWT_SECRET') ||
                'dev_jwt_secret_change_in_prod',
              signOptions: {
                expiresIn:
                  (configService.get<string>('JWT_EXPIRES_IN') as any) || '1d',
              },
            })),
        }),
        ...(options.imports ?? []),
      ],
      providers: [
        AuthService,
        LocalStrategy,
        JwtStrategy,
        GoogleStrategy,
        FacebookStrategy,
      ],
      exports: [AuthService, JwtModule, PassportModule],
    };
  }
}
