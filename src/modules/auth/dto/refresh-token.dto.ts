// src/modules/auth/dto/refresh-token.dto.ts

import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token is required' })
  refreshToken: string;
}