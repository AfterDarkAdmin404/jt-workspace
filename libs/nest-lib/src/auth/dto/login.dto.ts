import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Username or email address used to authenticate',
    example: 'user@example.com',
    minLength: 3,
    maxLength: 255,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({
    description: 'Account password',
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
