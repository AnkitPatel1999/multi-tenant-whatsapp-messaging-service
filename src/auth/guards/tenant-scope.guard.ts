import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_SCOPE_KEY } from '../decorators/tenant-scope.decorator';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireTenantScope = this.reflector.getAllAndOverride<boolean>(TENANT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireTenantScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Tenant scope required');
    }

    return true;
  }
}