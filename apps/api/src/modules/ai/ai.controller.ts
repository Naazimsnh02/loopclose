import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentActor, Roles } from '../../common/actor';
import type { Actor } from '@loopclose/shared';
import { ProposalsService } from './proposals.service';
import { NavigatorService } from './navigator/navigator.service';
import { SummariserService } from './summariser/summariser.service';
import { RiskService } from './risk/risk.service';
import { PrismaService } from '../../common/prisma.service';

class NavigatorTurnDto {
  @IsOptional() @IsString() inboundText?: string;
}
class DecideDto {
  @IsIn(['accepted', 'rejected']) decision!: 'accepted' | 'rejected';
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() note?: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    private readonly navigator: NavigatorService,
    private readonly summariser: SummariserService,
    private readonly riskService: RiskService,
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
  ) {}

  @Post('navigator/:caseId/turn')
  @Roles('coordinator', 'coordinator_lead', 'admin')
  navigatorTurn(@Param('caseId') caseId: string, @Body() dto: NavigatorTurnDto) {
    return this.navigator.runTurn(caseId, dto.inboundText);
  }

  @Post('summaries/:caseId')
  @Roles('phc_clinician', 'phc_lead', 'specialist', 'breast_radiologist', 'coordinator')
  draftSummary(@Param('caseId') caseId: string) {
    return this.summariser.draft(caseId);
  }

  @Get('risk/:caseId')
  risk(@Param('caseId') caseId: string) {
    return this.riskService.score(caseId);
  }

  @Get('proposals')
  listProposals(@Query('status') status?: string, @Query('caseId') caseId?: string, @Query('kind') kind?: string) {
    return this.proposals.list({ status, caseId, kind });
  }

  /** Human decision on any AI proposal — the only way a proposal takes effect. */
  @Post('proposals/:id/decide')
  @Roles('coordinator', 'coordinator_lead', 'phc_clinician', 'phc_lead', 'admin')
  decide(@Param('id') id: string, @Body() dto: DecideDto, @CurrentActor() actor: Actor) {
    if (actor.kind !== 'human') throw new ForbiddenException('Only a person can decide on an AI proposal');
    return this.proposals.decide(id, dto.decision, actor, { ownerId: dto.ownerId, note: dto.note });
  }
}
