import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GroupModule } from './group/group.module';
import { PointOfInterestModule } from './point-of-interest/point-of-interest.module';

@Module({
  imports: [GroupModule, PointOfInterestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
