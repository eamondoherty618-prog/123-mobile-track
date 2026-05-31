import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { PwaRegistrar } from "@/components/mobile/PwaRegistrar";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";

import "./globals.css";

export const metadata: Metadata = {
  title: "123 Mobile Track",
  description: "Fleet tracking SaaS dashboard for service vehicles and mobile fleets.",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "123 Mobile Track",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/123-mobile-track-logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/123-mobile-track-logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "123 Mobile Track",
    description: "Fleet tracking SaaS dashboard for service vehicles and mobile fleets.",
    url: "https://123mobiletrack.com",
    siteName: "123 Mobile Track",
    images: [
      {
        url: "https://123mobiletrack.com/123-mobile-track-logo.png",
        width: 512,
        height: 512,
        alt: "123 Mobile Track",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "123 Mobile Track",
    description: "Fleet tracking SaaS dashboard for service vehicles and mobile fleets.",
    images: ["https://123mobiletrack.com/123-mobile-track-logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <WorkspaceProvider>
            <PwaRegistrar />
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
