export default function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700 uppercase ring-1 ring-emerald-200">
          Tailwind CSS v4 Ready
        </span>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          AdSociety Partner Web
        </h1>

        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Configured with Tailwind CSS v4 via{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800">
            @tailwindcss/postcss
          </code>{' '}
          and{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800">
            @import &apos;tailwindcss&apos;
          </code>{' '}
          in{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800">
            src/app/global.css
          </code>
          .
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              PostCSS Plugin
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Processed automatically by Next.js using{' '}
              <code className="font-mono text-xs text-slate-800">
                postcss.config.mjs
              </code>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Zero-Config Content Scanning
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Utility classes in{' '}
              <code className="font-mono text-xs text-slate-800">src/</code> are
              detected automatically.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
