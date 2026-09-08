import { NotificationType } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  enabled: boolean;
}
export class UpdateNotificationTypePreferenceDto extends UpdateNotificationPreferenceDto {
  @IsEnum(NotificationType)
  type: NotificationType;
}
export interface NotificationPreferencesResponseDto {
  enabled: boolean;
  groups: {
    groupId: number;
    groupName: string;
    enabled: boolean;
    types: Record<NotificationType, boolean>;
  }[];
}
