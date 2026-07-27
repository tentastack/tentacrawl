import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProxyServerEntity, ProxyUsageEntity } from '../data/entities';
import { ProxyServerController } from './proxy-server.controller';
import { ProxyServerService } from './proxy-server.service';
import { ProxyValidationService } from './proxy-validation.service';

@Module({
  imports: [MikroOrmModule.forFeature([ProxyServerEntity, ProxyUsageEntity])],
  controllers: [ProxyServerController],
  providers: [ProxyServerService, ProxyValidationService],
})
export class ProxyApiModule {}
