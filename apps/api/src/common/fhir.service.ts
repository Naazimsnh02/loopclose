import { Injectable } from '@nestjs/common';
import { FhirClient } from '@loopclose/fhir';

/** HAPI client wrapper; the projector (E2.4) writes through the outbox, never inline in requests. */
@Injectable()
export class FhirService extends FhirClient {
  constructor() {
    super({ baseUrl: process.env.FHIR_BASE_URL ?? 'http://localhost:8080/fhir' });
  }
}
