import { Injectable, PipeTransform } from '@nestjs/common';
import { LoginUserDto } from '../dto/login-user.dto';

@Injectable()
export class NormalizeLoginUserPipe implements PipeTransform<
  LoginUserDto,
  LoginUserDto
> {
  transform(loginUserDto: LoginUserDto): LoginUserDto {
    return {
      ...loginUserDto,
      email: loginUserDto.email.trim().toLowerCase(),
    };
  }
}
