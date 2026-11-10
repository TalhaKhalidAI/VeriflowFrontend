// src/HOCS/withPermissions.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export type PermissionMode = 'all' | 'any';

export interface PermissionRequirement {
  permissions: string[];
  mode: PermissionMode;
  adminOnly?: boolean;
}

export const PERMISSION_MAP: Record<string, PermissionRequirement> = {
  dashboard: { permissions: [], mode: 'any' },
  keys: { permissions: ['keys.view', 'keys.create', 'keys.delete', 'keys.delete.any'], mode: 'any' },
  rules: { permissions: ['inventory_rules.view', 'inventory_rules.create', 'inventory_rules.update', 'inventory_rules.delete'], mode: 'any' },
  shifts: { permissions: ['shifts.view', 'shifts.view.any', 'shifts.view.all', 'shifts.view.own', 'shifts.create', 'shifts.delete', 'shifts.delete.any'], mode: 'any' },
  scans: { permissions: ['scans.view.any', 'scans.view.own', 'scans.create'], mode: 'any' },
  admin: {
    permissions: [
      'admin.access',
      'admin.anyuser.password.update',
      'admin.user.enable',
      'admin.users.view',
      'admin.users.disable',
      'admin.users.delete',
      'admin.users.restore',
      'admin.users.promote',
      'admin.users',
      'admin.settings.view',
      'admin.settings.update',
      'admin.view_all',
      'admin.system.kill_switch',
    ],
    mode: 'any',
  },
  security: { permissions: [], mode: 'any' },
};

export const checkPermission = (
  userPermissions: Record<string, boolean> = {},
  requiredPermissions: string[] = [],
  mode: PermissionMode = 'any',
  userRole?: string,
  userRoleFromAPI?: string,
  adminOnly?: boolean
): { allowed: boolean; missing?: string[]; required?: string[] } => {
  const isAdmin = userRole?.toLowerCase() === 'admin' || userRoleFromAPI?.toLowerCase() === 'admin';

  // Strict Admin Isolation: If this requirement is adminOnly, non-admins are unconditionally forbidden!
  if (adminOnly && !isAdmin) {
    return { allowed: false, required: ['role:admin'], missing: ['role:admin'] };
  }

  // Admins bypass normal permission checks
  if (isAdmin) return { allowed: true };

  // If requirement is public to authenticated users
  if (!requiredPermissions || requiredPermissions.length === 0) return { allowed: true };

  if (!userPermissions || Object.keys(userPermissions).length === 0) {
    return { allowed: false, required: requiredPermissions, missing: requiredPermissions };
  }

  if (mode === 'all') {
    const missing = requiredPermissions.filter((p) => !userPermissions[p]);
    if (missing.length > 0) {
      return { allowed: false, missing, required: requiredPermissions };
    }
    return { allowed: true };
  }

  if (mode === 'any') {
    const hasAny = requiredPermissions.some((p) => userPermissions[p] === true);
    if (!hasAny) {
      return { allowed: false, required: requiredPermissions };
    }
    return { allowed: true };
  }

  return { allowed: false };
};

export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  pageKey: string,
  fallbackPath: string = '/dashboard'
) {
  const WrappedComponent = (props: P) => {
    const user = useAuthStore((state) => state.user);
    const permissions = user?.permissions || {};
    const requirement = PERMISSION_MAP[pageKey];

    const { allowed, missing, required } = checkPermission(
      permissions,
      requirement?.permissions || [],
      requirement?.mode || 'any',
      user?.role,
      user?.user_role,
      requirement?.adminOnly
    );

    if (!allowed) {
      if (missing && missing.length > 0) {
        console.warn(`🔒 [withPermission] Access denied for ${pageKey}. Missing: ${missing.join(', ')}`);
      } else if (required && required.length > 0) {
        console.warn(`🔒 [withPermission] Access denied for ${pageKey}. Requires: ${required.join(', ')}`);
      }
      return <Navigate to={fallbackPath} replace />;
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withPermission(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
}

export function useIsAdmin(): boolean {
  const user = useAuthStore((state) => state.user);
  return user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
}

export function usePermission(pageKey: string) {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || {};
  const requirement = PERMISSION_MAP[pageKey];

  if (!requirement) {
    return { allowed: true, missing: [], required: [] };
  }

  return checkPermission(
    permissions,
    requirement.permissions,
    requirement.mode,
    user?.role,
    user?.user_role,
    requirement.adminOnly
  );
}

export function useHasPermission(permission: string): boolean {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
  if (isAdmin) return true;
  return Boolean(user?.permissions?.[permission]);
}

export function PermissionGuard({
  children,
  pageKey,
  fallback = null,
}: {
  children: React.ReactNode;
  pageKey: string;
  fallback?: React.ReactNode;
}) {
  const { allowed } = usePermission(pageKey);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
