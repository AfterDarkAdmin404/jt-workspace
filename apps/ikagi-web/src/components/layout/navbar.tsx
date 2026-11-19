'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../../hooks/use-auth';

export function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Ikagi
        </Link>

        <nav className="flex items-center gap-4">
          {isLoading ? (
            <span className="text-sm text-slate-400">Loading...</span>
          ) : isAuthenticated && user ? (
            <>
              <Link
                href="/profile"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Profile
              </Link>
              <span className="hidden text-sm text-slate-500 sm:inline">
                {user.username || user.email}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? 'Signing out...' : 'Logout'}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
