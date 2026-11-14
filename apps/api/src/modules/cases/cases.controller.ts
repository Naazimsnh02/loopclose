import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor, Owner } from '@loopclose/shared';
import { CurrentActor, Roles } from '../../common/actor';
import { CasesService } from './cases.service';

class OwnerDto implements Owner {
  @IsString() id!: string;
  @IsString() role!: string;
  @IsOptional() @IsString() organizationId?: string;
}

class TransitionDto {
  @IsString() to!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @ValidateNested() @Type(() => OwnerDto) owner?: OwnerDto;
  @IsOptional() @IsIn(['no_show', 'referral_declined']) loopReason?: 'no_show' | 'referral_declined';
}

class EvidenceDto {
  @IsString() type!: string;
  @IsString() reference!: string;
}

class CloseDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EvidenceDto) evidence?: EvidenceDto[];
  @IsOptional() @IsString() decisionReason?: string;
}

class ExitDto {
  @IsIn(['declined_by_patient', 'lost_to_follow_up']) kind!: 'declined_by_patient' | 'lost_to_follow_up';
  @IsString() justification!: string;
}

class OutreachDto {
  @IsIn(['web_chat', 'whatsapp', 'sms', 'email', 'phone']) channel!: string;
  @IsIn(['delivered', 'failed', 'no_response', 'reached']) outcome!: 'delivered' | 'failed' | 'no_response' | 'reached';
  @IsOptional() @IsString() at?: string;
}

class AssignDto {
  @ValidateNested() @Type(() => OwnerDto) owner!: OwnerDto;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Query('tab') tab?: 'overdue' | 'unassigned' | 'rejected' | 'stalled' | 'at_risk' | 'all',
    @Query('state') state?: string,
    @Query('ownerId') ownerId?: string,
    @Query('programmeId') programmeId?: string,
    @Query('tier') tier?: string,
  ) {
    return this.cases.list({ tab, state, ownerId, programmeId, tier }, actor);
  }

  @Get('summary')
  summary(@CurrentActor() actor: Actor, @Query('programmeId') programmeId?: string, @Query('tier') tier?: string) {
    return this.cases.summary({ ...(programmeId ? { programmeId } : {}), ...(tier ? { tier } : {}) }, actor);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cases.get(id);
  }

  @Get(':id/timeline')
  timeline(@Param('id') id: string) {
    return this.cases.timeline(id);
  }

  @Post(':id/transition')
  transition(@Param('id') id: string, @Body() dto: TransitionDto, @CurrentActor() actor: Actor) {
    return this.cases.execute(id, {
      type: 'transition',
      to: dto.to,
      actor,
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.owner ? { owner: dto.owner } : {}),
      ...(dto.loopReason ? { loopReason: dto.loopReason } : {}),
    });
  }

  @Post(':id/owner/assign')
  @Roles('coordinator', 'coordinator_lead', 'phc_lead', 'specialist_lead', 'programme_manager')
  assign(@Param('id') id: string, @Body() dto: AssignDto, @CurrentActor() actor: Actor) {
    return this.cases.execute(id, { type: 'assign_owner', owner: dto.owner, actor, ...(dto.reason !== undefined ? { reason: dto.reason } : {}) });
  }

  /** Record a human outreach attempt (feeds the lost-to-follow-up protocol gate). */
  @Post(':id/outreach')
  outreach(@Param('id') id: string, @Body() dto: OutreachDto, @CurrentActor() actor: Actor) {
    return this.cases.execute(id, { type: 'record_outreach', actor, attempt: { channel: dto.channel as never, outcome: dto.outcome, at: dto.at ?? new Date().toISOString() } });
  }

  /** Closure is evidence-gated in the engine; this endpoint just shapes the command (E3.5). */
  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseDto, @CurrentActor() actor: Actor) {
    const now = new Date().toISOString();
    return this.cases.execute(id, {
      type: 'close',
      actor,
      ...(dto.evidence ? { evidence: dto.evidence.map((e) => ({ ...e, recordedBy: actor, recordedAt: now })) } : {}),
      ...(dto.decisionReason ? { humanDecision: { actor, reason: dto.decisionReason, decidedAt: now } } : {}),
    });
  }

  @Post(':id/exit')
  @Roles('coordinator', 'coordinator_lead', 'phc_clinician', 'phc_lead', 'specialist', 'specialist_lead', 'breast_clinic')
  exit(@Param('id') id: string, @Body() dto: ExitDto, @CurrentActor() actor: Actor) {
    return this.cases.execute(id, { type: 'exit', kind: dto.kind, actor, justification: dto.justification });
  }
}
