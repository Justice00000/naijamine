import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource-variable/jetbrains-mono/index.css";

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
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <div className="text-7xl font-bold text-gradient">404</div>
        <h2 className="mt-3 text-xl font-semibold">Lost in the cloud</h2>
        <p className="mt-2 text-sm text-muted-foreground">This route doesn't exist. Let's get you back to mining.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="glass rounded-3xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold">Something glitched</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f5efff" },
      { title: "Niaja Mine— Premium Cloud Crypto Mining" },
      { name: "description", content: "Buy hash-rate contracts, track earnings in real time, and withdraw to any wallet. Nimbus is a premium cloud crypto mining platform for everyone." },
      { property: "og:title", content: "Niaja Mine— Premium Cloud Crypto Mining" },
      { property: "og:description", content: "Buy hash-rate contracts, track earnings in real time, and withdraw to any wallet. Nimbus is a premium cloud crypto mining platform for everyone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Niaja Mine— Premium Cloud Crypto Mining" },
      { name: "twitter:description", content: "Buy hash-rate contracts, track earnings in real time, and withdraw to any wallet. Nimbus is a premium cloud crypto mining platform for everyone." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/f4604938-8a2e-49b1-9b62-554c1c6f799e" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/f4604938-8a2e-49b1-9b62-554c1c6f799e" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    // Capture referral code from ANY entry URL and persist across OAuth redirects
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && ref.trim()) {
        sessionStorage.setItem("nimbus_pending_ref", ref.trim());
      }
    } catch {}

    let unsub: (() => void) | undefined;
    let mounted = true;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (!mounted) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
