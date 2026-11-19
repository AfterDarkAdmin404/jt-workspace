'use client';

import Link from 'next/link';
import { useAuth } from '../hooks/use-auth';

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          Ikagi Platform
        </span>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {isAuthenticated && user
            ? `Welcome back, ${user.username || user.email}`
            : 'Build and ship faster with Ikagi'}
        </h1>

        <p className="mt-3 max-w-2xl text-base text-slate-600">
          {isAuthenticated
            ? 'Your session is active. Manage your account details or continue exploring your workspace.'
            : 'A clean, type-safe foundation with centralized authentication, protected routes, and OpenAPI-generated services.'}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {isLoading ? (
            <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-200" />
          ) : isAuthenticated ? (
            <Link
              href="/profile"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to Profile
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Session Management
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Automatic token hydration on load, Bearer header injection, and
            cross-tab logout synchronization.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Route Protection
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Dedicated guards for authenticated pages and public-only auth flows
            with return-URL preservation.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Typed API Client
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            End-to-end TypeScript models and SDK methods generated directly from
            the backend OpenAPI specs.
          </p>
        </div>
      </section>
    </div>
  );
}
