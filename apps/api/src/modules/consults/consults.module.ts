import { Controller, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * E4.3 — Consult threads (patient→clinician async; clinician→clinician eConsult) with structured
 * outcomes and time-to-response metric. E4.4 — scheduling stub (slots, book, attended/no-show).
 * TODO: ConsultsService, SchedulingService, controllers; outcome → case transition `consult_done`.
 */
@ApiTags('consults')
@Controller('consults')
class ConsultsController {}

@Module({ controllers: [ConsultsController] })
export class ConsultsModule {}
