import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nombre: string;

  @IsEnum(Role)
  role: Role;

  @ValidateIf((dto) => dto.role === 'CLIENTE')
  @IsString()
  clienteId?: string;
}
