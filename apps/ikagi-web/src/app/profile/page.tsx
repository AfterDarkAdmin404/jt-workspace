'use client';

import { useState } from 'react';
import { ApiError } from '../../api/api-client';
import { ProtectedRoute } from '../../components/guards/protected-route';
import { useAuth } from '../../hooks/use-auth';

function ProfileContent() {
  const { user, refreshProfile, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  if (!user) return null;

  async function handleRefresh() {
    setError(null);
    setIsRefreshing(true);
    try {
      await refreshProfile();
      setRefreshedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to refresh profile.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Profile
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your authenticated account details.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh profile'}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {refreshedAt && !error && (
          <p className="mt-4 text-xs text-slate-500">
            Profile refreshed at {refreshedAt}
          </p>
        )}

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              User ID
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-slate-900">
              {user.id}
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {user.email}
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Username
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {user.username || '—'}
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Provider
            </dt>
            <dd className="mt-1 text-sm capitalize text-slate-900">
              {user.provider}
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Created At
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {new Date(user.createdAt).toLocaleString()}
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Updated At
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {new Date(user.updatedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
