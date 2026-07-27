import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { setChallengerConfigDto, setChallengerEnabledDto } from '../data/schemas';
import { ChallengerApiService } from './challenger.service';

@Controller('challengers')
export class ChallengerController {
  constructor(private readonly service: ChallengerApiService) {}

  @Get()
  list(@Query('capability') capability?: string) {
    return this.service.list(capability);
  }

  @Get('runs/:taskId/signals')
  runSignals(@Param('taskId') taskId: string) {
    return this.service.runSignals(taskId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(decodeURIComponent(id));
  }

  @Put(':id/enabled')
  async setEnabled(@Param('id') id: string, @Body() body: unknown) {
    const parsed = setChallengerEnabledDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.service.setEnabled(decodeURIComponent(id), parsed.data.enabled);
    return { id: decodeURIComponent(id), enabled: parsed.data.enabled };
  }

  @Get(':id/config')
  getConfig(@Param('id') id: string) {
    return this.service.getConfig(decodeURIComponent(id));
  }

  @Put(':id/config')
  async setConfig(@Param('id') id: string, @Body() body: unknown) {
    const parsed = setChallengerConfigDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.service.setConfig(decodeURIComponent(id), parsed.data.config);
    return { id: decodeURIComponent(id) };
  }

  @Get(':id/health')
  health(@Param('id') id: string) {
    return this.service.health(decodeURIComponent(id));
  }

  @Get(':id/signals')
  signals(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.service.signals(decodeURIComponent(id), parsedLimit);
  }

  @Delete(':id')
  async purge(@Param('id') id: string) {
    await this.service.purge(decodeURIComponent(id));
    return { id: decodeURIComponent(id), purged: true };
  }
}
