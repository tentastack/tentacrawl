import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProxyServerEntity, ProxyUsageEntity } from '../data/entities';
import { ProxyManagerService } from './proxy-manager.service';
import { ProxyChallengerExtension } from './proxy.challenger';

@Module({
  imports: [MikroOrmModule.forFeature([ProxyServerEntity, ProxyUsageEntity])],
  providers: [ProxyManagerService, ProxyChallengerExtension],
})
export class ProxyWorkerModule {}
