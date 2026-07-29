import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { BootstrapDemoDto } from './setup.dto';
import { AppConfigService } from '@/shared/config/app-config.service';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    private readonly config: AppConfigService,
  ) {}

  @Post('demo')
  @ApiHeader({ name: 'x-setup-token', required: true })
  async createDemo(@Headers('x-setup-token') token: string | undefined, @Body() dto: BootstrapDemoDto) {
    if (!this.config.bootstrapSetupToken || token !== this.config.bootstrapSetupToken) {
      throw new ForbiddenException('Invalid setup token');
    }
    return this.setup.createDemo(dto);
  }
}
