import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuthProvider } from '../../entities/user.entity';

export class UserProfileResponseDto {
  @ApiProperty({
    description: 'Unique user identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Optional unique username',
    example: 'johndoe',
    nullable: true,
  })
  username!: string | null;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email',
  })
  email!: string;

  @ApiProperty({
    description: 'Authentication provider',
    enum: ['local', 'google', 'facebook'],
    enumName: 'AuthProvider',
    example: 'local',
    default: 'local',
  })
  provider!: AuthProvider;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when user was created',
    example: '2026-11-18T08:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when user was last updated',
    example: '2026-11-18T08:00:00.000Z',
    format: 'date-time',
  })
  updatedAt!: Date;
}

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Signed JWT Bearer access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Authenticated user profile',
    type: () => UserProfileResponseDto,
  })
  user!: UserProfileResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Indicates whether the operation succeeded',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Operation completed successfully',
  })
  message!: string;
}
