import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProxyPoolEntity, ProxyLeaseEntity } from '../data/entities';
import { ProxyPoolController } from './proxy-pool.controller';
import { ProxyPoolService } from './proxy-pool.service';
import { ProxyProviderRegistrar } from './proxy-provider.registrar';
import { ProxyProviderRegistry } from '../provider/proxy-provider.registry';
import { BrightDataProvider } from '../provider/brightdata.provider';
import { PROXY_PROVIDERS_TOKEN } from '../provider/proxy-provider.decorator';

@Module({
  imports: [MikroOrmModule.forFeature([ProxyPoolEntity, ProxyLeaseEntity])],
  controllers: [ProxyPoolController],
  providers: [
    ProxyProviderRegistry,
    ProxyPoolService,
    ProxyProviderRegistrar,
    {
      provide: PROXY_PROVIDERS_TOKEN,
      useValue: [BrightDataProvider],
    },
  ],
})
export class ProxyApiModule {}
