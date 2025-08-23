import { SetMetadata } from '@nestjs/common';

export const TENANT_SCOPE_KEY = 'tenantScope';
export const TenantScope = () => SetMetadata(TENANT_SCOPE_KEY, true);
