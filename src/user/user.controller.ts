import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ResendVerificationEmailDto } from './dto/resend-verification-email.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SessionAuthGuard } from './guard/session-auth.guard';
import type { AuthenticatedRequest } from './interface/authenticated-request.interface';
import { NormalizeLoginUserPipe } from './pipe/normalize-login-user.pipe';
import { NormalizeUserPipe } from './pipe/normalize-user.pipe';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(
    @Body(NormalizeUserPipe) createUserDto: CreateUserDto,
  ): Promise<MessageResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    return this.userService.findAll();
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string): Promise<UserResponseDto> {
    return this.userService.findByEmail(email);
  }

  @Get('verify-email')
  async verifyEmail(
    @Query() verifyEmailDto: VerifyEmailDto,
  ): Promise<MessageResponseDto> {
    return this.userService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(
    @Body() resendVerificationEmailDto: ResendVerificationEmailDto,
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

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: AuthenticatedRequest): UserResponseDto {
    return request.user!;
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.userService.logout(request.sessionId!);
  }
}
