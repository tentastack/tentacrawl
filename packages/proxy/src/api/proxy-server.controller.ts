import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createProxyServerDto,
  listProxyServersQuerySchema,
  testProxyEndpointDto,
  updateProxyServerDto,
} from '../data/schemas';
import { ProxyServerService } from './proxy-server.service';
import { ProxyValidationService } from './proxy-validation.service';

@Controller('proxy')
export class ProxyServerController {
  constructor(
    private readonly service: ProxyServerService,
    private readonly validationService: ProxyValidationService,
  ) {}

  @Get('servers')
  list(@Query() query: Record<string, string>) {
    const parsed = listProxyServersQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.service.list(parsed.data);
  }

  // must stay above 'servers/:id'
  @Get('servers/options')
  options() {
    return this.service.options();
  }

  // must stay above 'servers/:id'
  @Get('servers/locations')
  locations() {
    return this.service.locations();
  }

  @Get('servers/:id')
  get(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  // live-tests a candidate url+credentials before save
  @Post('servers/test-endpoint')
  async testEndpoint(@Body() body: unknown) {
    const parsed = testProxyEndpointDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const credentials = await this.service.resolveTestCredentials(parsed.data);
    return this.validationService.test({ url: parsed.data.url, ...credentials });
  }

  @Get('servers/:id/usage')
  usage(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.service.usage(id, parsedLimit);
  }

  @Post('servers')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = createProxyServerDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const server = await this.service.create(parsed.data);
    return { id: server.id, name: server.name };
  }

  @Put('servers/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateProxyServerDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const server = await this.service.update(id, parsed.data);
    return { id: server.id, name: server.name };
  }

  @Delete('servers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }
}
