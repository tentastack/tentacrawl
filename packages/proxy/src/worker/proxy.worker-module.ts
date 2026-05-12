import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProxyPoolEntity, ProxyLeaseEntity } from '../data/entities';
import { ProxyManagerService } from './proxy-manager.service';
import { ProxyRunnerHook } from './proxy.hook';
import { BrightDataProvider } from '../provider/brightdata.provider';
import { PROXY_PROVIDERS_TOKEN } from '../provider/proxy-provider.decorator';

@Module({
  imports: [MikroOrmModule.forFeature([ProxyPoolEntity, ProxyLeaseEntity])],
  providers: [
    ProxyManagerService,
    ProxyRunnerHook,
    {
      provide: PROXY_PROVIDERS_TOKEN,
      useValue: [BrightDataProvider],
    },
  ],
})
export class ProxyWorkerModule {}
