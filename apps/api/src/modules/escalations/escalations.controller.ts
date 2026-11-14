import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../../common/actor';
import { EscalationsService } from './escalations.service';

class ResolveDto {
  @IsString() resolution!: string;
}

@ApiTags('escalations')
@ApiBearerAuth()
@Controller('escalations')
export class EscalationsController {
  constructor(private readonly escalations: EscalationsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('targetRole') targetRole?: string) {
    return this.escalations.list({ status, targetRole });
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.escalations.resolve(id, user.id, dto.resolution);
  }
}
