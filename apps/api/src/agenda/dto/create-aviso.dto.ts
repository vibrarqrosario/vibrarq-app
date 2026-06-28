import { IsString } from 'class-validator';

export class CreateAvisoDto {
  @IsString()
  texto: string;
}
