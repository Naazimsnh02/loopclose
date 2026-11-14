/**
 * Service-level tests mock Prisma/Repository; engine invariants are covered in packages/shared.
 * TODO E15.2: e2e against Postgres + HAPI in CI.
 */
describe('CasesService', () => {
  it.todo('openForResult resolves urgency tier from result flags and patient age');
  it.todo('execute surfaces MachineError codes as 400 with code/details');
  it.todo('commit uses expectedVersion for optimistic concurrency (409 on race)');
  it.todo('list scopes non-programme users to their organisation');
});
