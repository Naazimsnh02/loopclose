import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProgrammeRegistry } from './programme-registry.service';
import { ClockService } from './clock.service';
import { FhirService } from './fhir.service';
import { JobsService } from './jobs.service';

@Global()
@Module({
  providers: [PrismaService, ProgrammeRegistry, ClockService, FhirService, JobsService],
  exports: [PrismaService, ProgrammeRegistry, ClockService, FhirService, JobsService],
})
export class CommonModule {}
