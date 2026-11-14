import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/** Per-feature kill-switch: env default, DB override, admin UI toggle (E12.3). */
@Injectable()
export class AiFeatureFlags {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(name: 'navigator' | 'summariser' | 'risk'): Promise<boolean> {
    const envDefault = (process.env[`AI_FEATURE_${name.toUpperCase()}`] ?? 'true') === 'true';
    const row = await this.prisma.aIFeatureFlag.findUnique({ where: { name } });
    return row ? row.enabled : envDefault;
  }

  async assertEnabled(name: 'navigator' | 'summariser' | 'risk') {
    if (!(await this.isEnabled(name))) throw new ServiceUnavailableException(`AI feature "${name}" is disabled`);
  }

  async set(name: string, enabled: boolean, updatedBy: string, reason?: string) {
    await this.prisma.auditLog.create({ data: { actorKind: 'human', actorId: updatedBy, action: 'toggle_feature', resource: 'AIFeatureFlag', resourceId: name, aiFeature: name, outcome: enabled ? 'enabled' : 'disabled', ...(reason ? { purpose: reason } : {}) } });
    return this.prisma.aIFeatureFlag.upsert({ where: { name }, update: { enabled, updatedBy }, create: { name, enabled, updatedBy } });
  }
}
