import { Body, Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsString } from 'class-validator';
import type { Actor, Channel } from '@loopclose/shared';
import { CurrentActor, Roles } from '../../common/actor';
import { PatientNavigator } from './patient-navigator.service';
import { Public } from '../auth/jwt-auth.guard';
import { MessagingService } from './messaging.service';
import { TemplateLibrary } from './template-library.service';

const channels = ['web_chat', 'whatsapp', 'sms', 'email', 'phone'] as const;

class SendTemplateDto {
  @IsString() caseId!: string;
  @IsString() templateId!: string;
  @IsIn(channels) channel!: Channel;
  @IsObject() vars!: Record<string, string>;
}
class InboundDto {
  @IsString() caseId!: string;
  @IsIn(channels) channel!: Channel;
  @IsString() text!: string;
}

@ApiTags('messaging')
@ApiBearerAuth()
@Controller('messages')
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly templates: TemplateLibrary,
    private readonly navigator: PatientNavigator,
  ) {}

  @Post('outbound')
  send(@Body() dto: SendTemplateDto, @CurrentActor() actor: Actor) {
    return this.messaging.sendTemplate({ ...dto, actor });
  }

  /** Simulated channel webhook. TODO E11.4: signature verification for real providers. */
  @Public()
  @Post('inbound')
  inbound(@Body() dto: InboundDto) {
    // Real providers must sign their webhooks; until E11.4 lands the open webhook only exists in demo mode.
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') throw new ForbiddenException('Unsigned inbound webhooks are disabled');
    return this.navigator.handleInbound(dto.caseId, dto.text, dto.channel);
  }

  /** Coordinator starts the navigator: approved result message + teach-back question on web chat. */
  @Post('navigator/:caseId/start')
  @Roles('coordinator', 'coordinator_lead', 'admin')
  startNavigator(@Param('caseId') caseId: string, @CurrentActor() actor: Actor) {
    return this.navigator.start(caseId, actor);
  }

  @Get('navigator/scripts')
  navigatorScripts() {
    return this.navigator.scriptsInfo();
  }

  @Get('case/:caseId')
  history(@Param('caseId') caseId: string) {
    return this.messaging.history(caseId);
  }

  @Get('templates')
  templatesList() {
    return this.templates.list().map((t) => ({ id: t.id, programme: t.programme, stage: t.stage, approval: t.approval }));
  }
}
