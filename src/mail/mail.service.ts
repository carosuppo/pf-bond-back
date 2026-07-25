import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly mailFrom: string;

  constructor(private readonly configService: ConfigService) {
    const mailHost = this.getRequiredEnv('MAIL_HOST');
    const mailPort = Number(this.getRequiredEnv('MAIL_PORT'));
    const mailUser = this.getRequiredEnv('MAIL_USER');
    const mailPassword = this.getRequiredEnv('MAIL_PASSWORD');

    this.mailFrom = this.getRequiredEnv('MAIL_FROM');

    this.transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: {
        user: mailUser,
        pass: mailPassword,
      },
    });
  }

  async sendEmailVerification(
    to: string,
    name: string,
    verificationUrl: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.mailFrom,
      to,
      subject: 'Verificá tu cuenta en Bond',
      text: `Hola ${name}. Para verificar tu cuenta en Bond, abrí este link: ${verificationUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Verificá tu cuenta en Bond</h2>
          <p>Hola ${name},</p>
          <p>Para activar tu cuenta, hacé click en el siguiente botón:</p>
          <p>
            <a
              href="${verificationUrl}"
              style="
                display: inline-block;
                padding: 10px 16px;
                background-color: #ffc107;
                color: #000;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
              "
            >
              Verificar cuenta
            </a>
          </p>
          <p>Si no creaste esta cuenta, podés ignorar este correo.</p>
        </div>
      `,
    });
  }

  private getRequiredEnv(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`La variable de entorno ${key} no está definida.`);
    }

    return value;
  }
}
