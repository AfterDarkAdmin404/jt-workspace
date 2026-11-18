import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current account password',
    example: 'OldPass123',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description:
      'New password (8-128 chars, at least 1 uppercase, 1 lowercase, and 1 number)',
    example: 'NewStrongPass123',
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
      'New password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number',
  })
  newPassword!: string;
}
