export class CurrentLocationResponseDto {
  latitude!: number;
  longitude!: number;
  accuracy!: number | null;
  capturedAt!: Date | null;
}
