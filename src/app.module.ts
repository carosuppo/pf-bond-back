import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GroupModule } from './group/group.module';
import { MemberModule } from './member/member.module';

@Module({
  imports: [GroupModule, MemberModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
