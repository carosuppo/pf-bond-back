import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/user.decorator';
import { MAX_PROFILE_PHOTO_SIZE } from './constants/profile-photo.constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ResendVerificationEmailDto } from './dto/resend-verification-email.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SessionAuthGuard } from './guard/session-auth.guard';
import { AccountDeletionRequestService } from './service/account-deletion-request.service';
import type { AuthenticatedRequest } from './interface/authenticated-request.interface';
import type { ProfilePhotoFile } from './interface/profile-photo-file.interface';
import { NormalizeEmailPipe } from './pipe/normalize-email.pipe';
import { NormalizeLoginUserPipe } from './pipe/normalize-login-user.pipe';
import { NormalizeUpdateUserPipe } from './pipe/normalize-update-user.pipe';
import { NormalizeUserPipe } from './pipe/normalize-user.pipe';
import { UserService } from './user.service';
import { AccountDeletionService } from './service/account-deletion.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly accountDeletionRequestService: AccountDeletionRequestService,
  ) {}

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(
    @Body(NormalizeEmailPipe)
    resendVerificationEmailDto: ResendVerificationEmailDto,
  ): Promise<MessageResponseDto> {
    return this.userService.resendVerificationEmail(resendVerificationEmailDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(NormalizeLoginUserPipe)
    loginUserDto: LoginUserDto,
  ): Promise<UserAuthResponseDto> {
    return this.userService.login(loginUserDto);
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.userService.logout(request.sessionId!);
  }

  @Post()
  async create(
    @Body(NormalizeUserPipe) createUserDto: CreateUserDto,
  ): Promise<MessageResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Post('account-deletion-requests')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async requestAccountDeletion(
    @Body(NormalizeEmailPipe)
    requestDto: ResendVerificationEmailDto,
  ): Promise<MessageResponseDto> {
    await this.accountDeletionRequestService.request(requestDto.email);
    return {
      message:
        'Si la cuenta existe, recibirás un enlace para confirmar su eliminación.',
    };
  }

  @Post('account-deletion-requests/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async confirmAccountDeletion(
    @Body() confirmDto: ConfirmAccountDeletionDto,
  ): Promise<void> {
    await this.accountDeletionRequestService.confirm(confirmDto.token);
  }

  @Get('verify-email')
  async verifyEmail(
    @Query() verifyEmailDto: VerifyEmailDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.userService.verifyEmail(verifyEmailDto);
    const appLink = new URL('bond://verify-email');
    appLink.searchParams.set('token', verifyEmailDto.token);
    response.setHeader('Cache-Control', 'no-store');
    response.redirect(302, appLink.toString());
  }

  @Post('verify-email-session')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async completeEmailVerification(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<UserAuthResponseDto> {
    return this.userService.completeEmailVerification(verifyEmailDto);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: AuthenticatedRequest): UserResponseDto {
    return request.user!;
  }

  @Delete('me')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() userId: number): Promise<void> {
    await this.accountDeletionService.deleteAccount(userId);
  }

  @Get('profile')
  @UseGuards(SessionAuthGuard)
  async getProfile(@CurrentUser() userId: number): Promise<UserResponseDto> {
    return await this.userService.getProfile(userId);
  }

  @Patch('password')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() userId: number,
  ): Promise<MessageResponseDto> {
    return await this.userService.changePassword(userId, changePasswordDto);
  }

  @Patch('me')
  @UseGuards(SessionAuthGuard)
  async updateMe(
    @Body(NormalizeUpdateUserPipe) updateUserDto: UpdateUserDto,
    @CurrentUser() userId: number,
  ): Promise<UserResponseDto> {
    return await this.userService.update(userId, updateUserDto);
  }

  @Patch('profile-photo')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_PROFILE_PHOTO_SIZE,
      },
    }),
  )
  async updateProfilePhoto(
    @UploadedFile() file: ProfilePhotoFile | undefined,
    @CurrentUser() userId: number,
  ): Promise<UserResponseDto> {
    return this.userService.updateProfilePhoto(userId, file);
  }
}
