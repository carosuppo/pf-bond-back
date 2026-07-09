import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';
import { NormalizeUserPipe } from './pipe/normalize-user.pipe';
import { LoginUserDto } from './dto/login-user.dto';
import { NormalizeLoginUserPipe } from './pipe/normalize-login-user.pipe';
import type { AuthenticatedRequest } from './interface/authenticated-request.interface';
import { SessionAuthGuard } from './guard/session-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(
    @Body(NormalizeUserPipe) createUserDto: CreateUserDto,
  ): Promise<UserAuthResponseDto> {
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
