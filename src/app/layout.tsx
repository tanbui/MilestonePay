import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";

export const metadata: Metadata = {
  title: { default: "Milestone Pay", template: "%s · Milestone Pay" },
  description:
    "AI-run milestone invoicing for software agencies: read the SOW, verify delivery, invoice through PayPal and pay subcontractors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen flex-wrap">
          <Sidebar />
          <main id="main" className="min-w-0 flex-[999_1_560px]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
