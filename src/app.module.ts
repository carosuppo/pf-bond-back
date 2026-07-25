import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GroupMembershipModule } from './group-membership/group-membership.module';
import { GroupModule } from './group/group.module';

@Module({
  imports: [GroupModule, GroupMembershipModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
