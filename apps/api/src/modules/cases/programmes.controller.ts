import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProgrammeRegistry } from '../../common/programme-registry.service';

/** Programme definitions (states, owner roles, SLAs, closure/exit rules) for UI steppers and action gating. */
@ApiTags('programmes')
@ApiBearerAuth()
@Controller('programmes')
export class ProgrammesController {
  constructor(private readonly programmes: ProgrammeRegistry) {}

  @Get()
  list() {
    return this.programmes.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.programmes.get(id);
  }
}
