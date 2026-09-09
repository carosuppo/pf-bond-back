import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

export class RegisterDeviceTokenDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
