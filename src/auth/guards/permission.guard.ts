import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../constants/permissions';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: string[]) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(PERMISSIONS_KEY, permissions, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }
    
    // For now, allow all authenticated users to proceed
    // In production, you would check groupId and permissions properly
    if (!user.groupId) {
      // Log warning but don't block the request for now
      console.warn(`User ${user.userId} has no groupId assigned`);
    }

    // Check if user has admin privileges (bypass permission checks)
    if (user.isAdmin) {
      return true;
    }

    // Check if user has required permissions based on their role
    // For now, we'll use a simple role-based system
    // In a real application, you might want to store user roles in the database
    let hasPermission = false;
    
    // Check if user has admin privileges (bypass permission checks)
    if (user.isAdmin) {
      hasPermission = true;
    } else {
      // For non-admin users, check if they have the required permission
      // This is a simplified check - in production you'd want to check against user's actual permissions
      hasPermission = requiredPermissions.some(permission => {
        // Basic permission mapping - you can enhance this based on your needs
        if (permission === PERMISSIONS.SEND_MESSAGES) {
          return true; // Allow all authenticated users to send messages for now
        }
        if (permission === PERMISSIONS.VIEW_LOGS) {
          return true; // Allow all authenticated users to view logs for now
        }
        if (permission === PERMISSIONS.VIEW_CONTACTS) {
          return true; // Allow all authenticated users to view contacts for now
        }
        if (permission === PERMISSIONS.VIEW_GROUPS) {
          return true; // Allow all authenticated users to view groups for now
        }
        return false; // Default to false for other permissions
      });
    }

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
