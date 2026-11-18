import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterLocalDto {
  @ApiProperty({
    description: 'Unique email address for the user account',
    example: 'newuser@example.com',
    format: 'email',
    maxLength: 255,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({
    description: 'Optional unique username',
    example: 'newuser',
    minLength: 3,
    maxLength: 50,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @ApiProperty({
    description:
      'Password (8-128 chars, at least 1 uppercase, 1 lowercase, and 1 number)',
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number',
  })
  password!: string;
}
