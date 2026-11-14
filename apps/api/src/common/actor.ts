import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Actor } from '@loopclose/shared';

export const ROLES_KEY = 'roles';
/** Restrict a handler to the given RBAC roles (E2.5). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedUser {
  id: string;
  role: string;
  organizationId: string;
  displayName: string;
}

/** Injects the authenticated human as a domain Actor. */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  const u = req.user;
  if (!u) return { kind: 'system', id: 'anonymous' };
  return { kind: 'human', id: u.id, role: u.role, organizationId: u.organizationId };
});

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
  return ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
});
