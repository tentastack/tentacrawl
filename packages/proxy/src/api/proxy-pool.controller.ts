import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ProxyProviderRegistry } from '../provider/proxy-provider.registry';
import { createProxyPoolDto, updateProxyPoolDto } from '../data/schemas';
import { ProxyPoolService } from './proxy-pool.service';

@Controller('proxy')
export class ProxyPoolController {
  constructor(
    private readonly poolService: ProxyPoolService,
    private readonly registry: ProxyProviderRegistry,
  ) {}

  @Get('providers')
  getProviders() {
    return this.registry
      .getAll()
      .map(({ id, name, description }) => ({ id, name, description }));
  }

  @Get('pools')
  async listPools() {
    return this.poolService.findAll();
  }

  @Get('pools/:id')
  async getPool(@Param('id') id: string) {
    return this.poolService.findById(id);
  }

  @Post('pools')
  @HttpCode(HttpStatus.CREATED)
  async createPool(@Body() body: unknown) {
    const parsed = createProxyPoolDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const pool = await this.poolService.create(parsed.data);
    return { id: pool.id, name: pool.name };
  }

  @Put('pools/:id')
  async updatePool(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateProxyPoolDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const pool = await this.poolService.update(id, parsed.data);
    return { id: pool.id, name: pool.name };
  }

  @Delete('pools/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePool(@Param('id') id: string) {
    await this.poolService.remove(id);
  }
}
