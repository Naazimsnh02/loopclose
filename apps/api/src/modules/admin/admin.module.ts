import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/actor';
import { PrismaService } from '../../common/prisma.service';
import { ProgrammeRegistry } from '../../common/programme-registry.service';
import { AiModule } from '../ai/ai.module';
import { AiFeatureFlags } from '../ai/feature-flags.service';
import { LlmClient } from '../ai/llm.client';
import { RiskService } from '../ai/risk/risk.service';

class ToggleDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

const FEATURES = [
  { name: 'navigator', label: 'Patient navigator', tier: 'Medium', llmFeature: 'navigator', offBehaviour: 'Patient replies go straight to the coordinator queue; no automated answers.' },
  { name: 'risk', label: 'Drop-off risk', tier: 'Medium', llmFeature: null, offBehaviour: 'No risk tiers or risk escalations; worklist falls back to SLA order.' },
  { name: 'summariser', label: 'Hand-off summariser', tier: 'Low–Medium', llmFeature: 'summariser', offBehaviour: 'Clinicians write referral summaries by hand.' },
] as const;

/** E7.7 / E12.3 — governance console: AI kill switches with audit, AI activity, programmes, templates, people. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('admin', 'programme_manager')
class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
    private readonly flags: AiFeatureFlags,
    private readonly llm: LlmClient,
    private readonly risk: RiskService,
  ) {}

  @Get('programmes')
  programmesList() {
    return this.programmes.list();
  }

  @Get('organizations')
  orgs() {
    return this.prisma.organization.findMany({ include: { _count: { select: { users: true, casesAsOwnerOrg: true } } }, orderBy: { name: 'asc' } });
  }

  @Get('users')
  users() {
    return this.prisma.user.findMany({ select: { id: true, email: true, displayName: true, role: true, organizationId: true, organization: { select: { name: true } } }, orderBy: [{ role: 'asc' }, { displayName: 'asc' }] });
  }

  /** Effective state of each AI feature, who last changed it, and how its proposals were decided. */
  @Get('ai-features')
  async features() {
    const rows = await this.prisma.aIFeatureFlag.findMany();
    const people = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.updatedBy).filter((x): x is string => !!x) } }, select: { id: true, displayName: true } });
    const decided = await this.prisma.aIProposal.groupBy({ by: ['feature', 'status'], _count: { _all: true } });
    return Promise.all(
      FEATURES.map(async (f) => {
        const row = rows.find((r) => r.name === f.name);
        const counts = Object.fromEntries(decided.filter((d) => d.feature === f.name).map((d) => [d.status, d._count._all]));
        return {
          ...f,
          enabled: await this.flags.isEnabled(f.name),
          source: row ? 'override' : 'environment',
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy ? (people.find((p) => p.id === row.updatedBy)?.displayName ?? row.updatedBy) : null,
          engine: f.name === 'risk' ? this.risk.engine() : f.llmFeature && this.llm.available ? `${this.llm.modelFor(f.llmFeature)} + rules` : 'Rules only (no model configured)',
          proposals: { pending: counts.pending ?? 0, accepted: counts.accepted ?? 0, rejected: counts.rejected ?? 0 },
        };
      }),
    );
  }

  @Post('ai-features/:name/toggle')
  @Roles('admin')
  async toggle(@Param('name') name: string, @Body() dto: ToggleDto, @CurrentUser() user: AuthenticatedUser) {
    if (!FEATURES.some((f) => f.name === name)) throw new BadRequestException(`Unknown AI feature ${name}`);
    return this.flags.set(name, dto.enabled, user.id, dto.reason);
  }

  /** Counts that show the guard-rails working: graded messages, blocks, hand-offs, human decisions. */
  @Get('ai-activity')
  async activity() {
    const [graded, blocked, navTurns, escalations, proposals] = await Promise.all([
      this.prisma.message.count({ where: { direction: 'outbound', NOT: { graderVerdict: { equals: null as never } } } }),
      this.prisma.message.count({ where: { direction: 'outbound', delivery: 'failed', templateId: { not: null } } }),
      this.prisma.auditLog.groupBy({ by: ['outcome'], where: { aiFeature: 'navigator', action: 'ai.invoke' }, _count: { _all: true } }),
      this.prisma.escalation.groupBy({ by: ['ruleId'], where: { status: { in: ['open', 'acknowledged'] } }, _count: { _all: true } }),
      this.prisma.aIProposal.groupBy({ by: ['kind', 'status'], where: { kind: { not: 'risk_assessment' } }, _count: { _all: true } }),
    ]);
    return {
      messagesGraded: graded,
      messagesBlocked: blocked,
      navigatorOutcomes: Object.fromEntries(navTurns.map((t) => [t.outcome ?? 'unknown', t._count._all])),
      openEscalationsByRule: Object.fromEntries(escalations.map((e) => [e.ruleId, e._count._all])),
      proposals: proposals.map((p) => ({ kind: p.kind, status: p.status, count: p._count._all })),
    };
  }

  /** Recent governance-relevant audit entries (kill switches, AI invocations, overrides). */
  @Get('audit')
  async audit(@Query('limit') limit?: string, @Query('action') action?: string) {
    const take = Math.min(Number(limit ?? 50) || 50, 200);
    const rows = await this.prisma.auditLog.findMany({ where: action ? { action } : { action: { in: ['toggle_feature', 'ai.invoke'] } }, orderBy: { at: 'desc' }, take });
    const people = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.filter((r) => r.actorKind === 'human').map((r) => r.actorId))] } }, select: { id: true, displayName: true } });
    return rows.map((r) => ({ ...r, actorName: r.actorKind === 'human' ? (people.find((p) => p.id === r.actorId)?.displayName ?? r.actorId) : r.actorId }));
  }
}

@Module({ imports: [AiModule], controllers: [AdminController] })
export class AdminModule {}
