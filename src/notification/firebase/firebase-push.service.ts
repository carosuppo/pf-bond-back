import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  App,
  cert,
  deleteApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushSendResult {
  invalidTokens: string[];
}

@Injectable()
export class FirebasePushService implements OnModuleDestroy {
  private readonly logger = new Logger(FirebasePushService.name);
  private readonly app: App | null;
  private readonly ownsApp: boolean;

  constructor(configService: ConfigService) {
    const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.app = null;
      this.ownsApp = false;
      this.logger.warn(
        'Firebase push deshabilitado: faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.',
      );
      return;
    }

    const existingApp = getApps()[0];
    this.app =
      existingApp ??
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    this.ownsApp = !existingApp;
  }

  async sendToToken(
    token: string,
    message: PushMessage,
  ): Promise<PushSendResult> {
    return this.sendToTokens([token], message);
  }

  async sendToTokens(
    tokens: string[],
    message: PushMessage,
  ): Promise<PushSendResult> {
    if (!this.app || tokens.length === 0) return { invalidTokens: [] };

    const invalidTokens: string[] = [];

    for (let start = 0; start < tokens.length; start += 500) {
      const chunk = tokens.slice(start, start + 500);
      const response = await getMessaging(this.app).sendEachForMulticast({
        tokens: chunk,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: { priority: 'high' },
      });

      response.responses.forEach((result, index) => {
        const code = result.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(chunk[index]);
        } else if (!result.success) {
          this.logger.error(
            `Firebase rechazó un envío (código: ${code ?? 'desconocido'}).`,
          );
        }
      });
    }

    return { invalidTokens };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.app && this.ownsApp) await deleteApp(this.app);
  }
}
