import { Global, Module } from '@nestjs/common';
import { ModuleExtensionRegistry } from './module-extension.registry';

@Global()
@Module({
  providers: [ModuleExtensionRegistry],
  exports: [ModuleExtensionRegistry],
})
export class CoreExtensionModule {}
