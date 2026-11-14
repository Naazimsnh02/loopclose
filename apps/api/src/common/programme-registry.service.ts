import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProgrammeYaml, type ProgrammeDefinition } from '@loopclose/shared';

/** Loads and validates config/programmes/*.yaml once at startup. Programmes are config, not code. */
@Injectable()
export class ProgrammeRegistry implements OnModuleInit {
  private readonly log = new Logger(ProgrammeRegistry.name);
  private readonly programmes = new Map<string, ProgrammeDefinition>();

  onModuleInit() {
    const dir = process.env.PROGRAMMES_DIR ?? resolve(process.cwd(), '../../config/programmes');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
      const programme = parseProgrammeYaml(readFileSync(resolve(dir, file), 'utf8'));
      this.programmes.set(programme.id, programme);
      this.log.log(`Loaded programme ${programme.id}@${programme.version} (${programme.states.length} states)`);
    }
    if (this.programmes.size === 0) this.log.warn(`No programmes found in ${dir}`);
  }

  get(id: string): ProgrammeDefinition {
    const p = this.programmes.get(id);
    if (!p) throw new NotFoundException(`Unknown programme ${id}`);
    return p;
  }

  list(): ProgrammeDefinition[] {
    return [...this.programmes.values()];
  }
}
