import { Type } from 'class-transformer';
import {
  IsDate,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateCurrentLocationDto {
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  latitude!: number;

  @IsLongitude({ message: 'Longitude must be between -180 and 180.' })
  longitude!: number;

  @IsOptional()
  @IsNumber({}, { message: 'Accuracy must be a number.' })
  @Min(0, { message: 'Accuracy cannot be negative.' })
  accuracy?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Captured date must be valid.' })
  capturedAt?: Date;
}
