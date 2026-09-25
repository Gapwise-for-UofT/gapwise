import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";
import { activeUniversity } from "@/universities/registry";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error("Gapwise route rendering failed.");
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen could not be opened. Timetable data saved in this browser is safe and has not
          been reset. Try loading the screen again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { name: "theme-color", content: "#0d1117" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Gapwise" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", href: "/logo-mark.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

const PLANNED_EDITIONS: Record<string, { name: string; shortName: string }> = {
  "tmu.gapwise.ca": { name: "Toronto Metropolitan University", shortName: "TMU" },
  "queens.gapwise.ca": { name: "Queen's University", shortName: "Queen's" },
  "laurier.gapwise.ca": { name: "Wilfrid Laurier University", shortName: "Laurier" },
};

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const university = activeUniversity();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname.toLowerCase().replace(/\.$/, "") : "";
  const isDev = ["localhost", "127.0.0.1", "gapwise.test"].includes(hostname);
  const devParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("university")
      : null;
  const plannedInfo =
    PLANNED_EDITIONS[hostname] ??
    (isDev && devParam && PLANNED_EDITIONS[`${devParam}.gapwise.ca`]
      ? PLANNED_EDITIONS[`${devParam}.gapwise.ca`]
      : null);

  if (!university || university.status === "planned" || plannedInfo) {
    const isPlanned = Boolean(plannedInfo || university?.status === "planned");
    const name = plannedInfo?.name ?? university?.name;
    const shortName = plannedInfo?.shortName ?? university?.shortName ?? "GW";
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground font-display font-semibold text-base border border-border">
            {shortName}
          </div>
          <h1 className="font-display text-2xl font-semibold">
            {isPlanned ? `${name} edition coming soon` : "University edition unavailable"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPlanned
              ? `We are currently preparing campus data and timetable adapters for ${name}. Check back soon!`
              : "This hostname is not registered with Gapwise."}
          </p>
          <a
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            href="https://gapwise.ca"
          >
            Open Gapwise for U of T
          </a>
        </div>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </AppErrorBoundary>
      <AppUpdatePrompt />
    </QueryClientProvider>
  );
}
