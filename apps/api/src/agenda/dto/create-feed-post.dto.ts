import { IsOptional, IsString } from 'class-validator';

export class CreateFeedPostDto {
  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsString()
  fotoUrl?: string;

  @IsOptional()
  @IsString()
  obraId?: string;
}
