import { Injectable, PipeTransform } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class NormalizeUserPipe implements PipeTransform {
  transform(createUserDto: CreateUserDto): CreateUserDto {
    return {
      ...createUserDto,
      name: createUserDto.name.trim(),
    };
  }
}
