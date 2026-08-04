import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkspaceGateway } from './workspace/workspace.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, WorkspaceGateway],
})
export class AppModule {}
