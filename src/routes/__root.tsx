import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

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

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nutricar Brasil" },
      { name: "description", content: "- Nutricar-facial is a user registration system for facial photo submissions, now enhanced with multi-channel verification options." },
      { name: "author", content: "Nutricar Brasil" },
      { name: "application-name", content: "Nutricar Brasil" },
      { property: "og:site_name", content: "Nutricar Brasil" },
      { property: "og:title", content: "Nutricar Brasil" },
      { property: "og:description", content: "- Nutricar-facial is a user registration system for facial photo submissions, now enhanced with multi-channel verification options." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Nutricar Brasil" },
      { name: "twitter:description", content: "- Nutricar-facial is a user registration system for facial photo submissions, now enhanced with multi-channel verification options." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/24902062-1b89-4531-90aa-638cf52b5e85/id-preview-d3eb9f65--9d299897-c471-4020-bc47-d7eeb2502a3e.lovable.app-1778697407855.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/24902062-1b89-4531-90aa-638cf52b5e85/id-preview-d3eb9f65--9d299897-c471-4020-bc47-d7eeb2502a3e.lovable.app-1778697407855.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  return <Outlet />;
}
