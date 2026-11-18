import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuthProvider, User } from '../entities/user.entity';
import { RegisterLocalDto } from './dto/register-local.dto';

export interface OAuthProfile {
  providerId: string;
  email: string;
  username?: string;
  avatarUrl?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  provider: AuthProvider;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService
  ) { }

  async validateLocalUser(identifier: string, password: string): Promise<User> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :identifier OR user.username = :identifier', {
        identifier,
      })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _, ...sanitized } = user;
    return sanitized as User;
  }

  async registerLocal(dto: RegisterLocalDto) {
    const existing = await this.usersRepo.findOne({
      where: dto.username
        ? [{ email: dto.email }, { username: dto.username }]
        : [{ email: dto.email }],
    });

    if (existing) {
      throw new ConflictException('User with email or username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      email: dto.email,
      username: dto.username ?? null,
      passwordHash,
      provider: 'local',
    });

    const saved = await this.usersRepo.save(user);
    return this.login(saved);
  }

  async validateOAuthUser(
    provider: Exclude<AuthProvider, 'local'>,
    profile: OAuthProfile
  ): Promise<User> {
    const providerField = provider === 'google' ? 'googleId' : 'facebookId';

    let user = await this.usersRepo.findOne({
      where: [
        { [providerField]: profile.providerId },
        { email: profile.email },
      ],
    });

    if (!user) {
      user = this.usersRepo.create({
        email: profile.email,
        username: profile.username ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        provider,
        [providerField]: profile.providerId,
      });
    } else {
      if (!user[providerField]) {
        user[providerField] = profile.providerId;
      }
      if (!user.avatarUrl && profile.avatarUrl) {
        user.avatarUrl = profile.avatarUrl;
      }
    }

    return this.usersRepo.save(user);
  }

  async validateUserById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException(
        'Both currentPassword and newPassword are required'
      );
    }

    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        'Password change is not available for this account'
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);

    return { success: true, message: 'Password updated successfully' };
  }

  login(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
    };
    const { passwordHash: _, ...safeUser } = user;
    return {
      accessToken: this.jwtService.sign(payload),
      user: safeUser,
    };
  }
}
