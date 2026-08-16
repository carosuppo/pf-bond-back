import { Injectable, PipeTransform } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class NormalizeUpdateUserPipe implements PipeTransform<
  UpdateUserDto,
  UpdateUserDto
> {
  transform(updateUserDto: UpdateUserDto): UpdateUserDto {
    return {
      ...updateUserDto,
      ...(updateUserDto.name !== undefined
        ? { name: updateUserDto.name.trim() }
        : {}),
      ...(updateUserDto.email !== undefined
        ? { email: updateUserDto.email.trim().toLowerCase() }
        : {}),
    };
  }
}
