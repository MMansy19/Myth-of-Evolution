import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient-emerald">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير متوفرة.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 glow-emerald"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "وهم التطور" },
      { name: "description", content: "منصة علمية نقدية تتناول خرافة التطور بالنقد الموضوعي المستند إلى أحدث الأبحاث، مسلّحة بأداة ذكاء اصطناعي متخصصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "وهم التطور" },
      { property: "og:description", content: "منصة علمية نقدية تتناول خرافة التطور بالنقد الموضوعي المستند إلى أحدث الأبحاث، مسلّحة بأداة ذكاء اصطناعي متخصصة." },
      { name: "twitter:title", content: "وهم التطور" },
      { name: "twitter:description", content: "منصة علمية نقدية تتناول خرافة التطور بالنقد الموضوعي المستند إلى أحدث الأبحاث، مسلّحة بأداة ذكاء اصطناعي متخصصة." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ft3ULPpKzzbP7zYO8zM7VBAFfT72/social-images/social-1777203400827-1741004461598.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ft3ULPpKzzbP7zYO8zM7VBAFfT72/social-images/social-1777203400827-1741004461598.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
