import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { workerConfigSchema, WorkerConfig } from '@tentacrawl/core';

export const VALIDATED_CONFIG = Symbol('VALIDATED_CONFIG');

@Module({
  providers: [
    {
      provide: VALIDATED_CONFIG,
      useFactory: (configService: ConfigService): WorkerConfig => {
        const raw = {
          NODE_ENV: configService.get('NODE_ENV'),
          PORT: configService.get('PORT'),
          LOG_LEVEL: configService.get('LOG_LEVEL'),
          MONGO_URI: configService.get('MONGO_URI'),
          MONGO_DB_NAME: configService.get('MONGO_DB_NAME'),
          REDIS_HOST: configService.get('REDIS_HOST'),
          REDIS_PORT: configService.get('REDIS_PORT'),
          REDIS_PASSWORD: configService.get('REDIS_PASSWORD'),
        };

        const result = workerConfigSchema.safeParse(raw);
        if (!result.success) {
          const errors = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n');
          throw new Error(`Config validation failed:\n${errors}`);
        }

        return result.data;
      },
      inject: [ConfigService],
    },
  ],
  exports: [VALIDATED_CONFIG],
})
export class WorkerConfigModule implements OnModuleInit {
  private readonly logger = new Logger(WorkerConfigModule.name);

  onModuleInit() {
    this.logger.log('Configuration validated successfully');
  }
}
