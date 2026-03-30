import { Module, Global } from '@nestjs/common';
import { RoutingService } from './routing.service';

@Global()
@Module({
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
