'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../hooks/use-auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export function ProtectedRoute({
  children,
  requiredRoles,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, sessionError, retrySession, logout } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const hasRequiredRoles =
    !requiredRoles?.length ||
    requiredRoles.some((role) => user?.roles?.includes(role));

  useEffect(() => {
    if (isLoading || sessionError) return;
    if (!isAuthenticated) {
      const target = pathname ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${target}`);
    }
  }, [isAuthenticated, isLoading, pathname, router, sessionError]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          <p className="text-sm text-slate-600">Checking session...</p>
        </div>
      </div>
    );
  }

  if (sessionError && !isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Unable to verify session
          </h2>
          <p className="mt-2 text-sm text-slate-600">{sessionError}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void retrySession()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!hasRequiredRoles) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Access Denied</h2>
          <p className="mt-1 text-sm text-slate-600">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
