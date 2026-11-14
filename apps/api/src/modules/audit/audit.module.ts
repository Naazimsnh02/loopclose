import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/actor';
import { PrismaService } from '../../common/prisma.service';

/**
 * E2.6 / E12.3 — Audit search. TODO: global interceptor logging every PHI read/write with purpose;
 * projection to FHIR AuditEvent via outbox.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('admin', 'programme_manager')
  search(@Query('patientId') patientId?: string, @Query('aiFeature') aiFeature?: string, @Query('action') action?: string) {
    return this.prisma.auditLog.findMany({
      where: { ...(patientId ? { patientId } : {}), ...(aiFeature ? { aiFeature } : {}), ...(action ? { action } : {}) },
      orderBy: { at: 'desc' },
      take: 500,
    });
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
