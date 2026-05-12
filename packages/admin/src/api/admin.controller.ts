import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { activityLogListQuerySchema } from '../data/schemas';

@Controller('dashboard')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('workers')
  getWorkers() {
    return this.adminService.listWorkers();
  }

  @Get('activity')
  getActivity(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsed = activityLogListQuerySchema.safeParse({
      limit,
      offset,
    });

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.adminService.listActivity(parsed.data);
  }
}