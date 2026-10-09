import type { Metadata, Viewport } from "next";
import { isDemoMode } from "@/lib/demo";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FlightPool • Mumbai Airport Cab Sharing (BOM)",
  description:
    "Share an airport cab from Mumbai Airport (BOM Terminal 1 & 2) to Thane, Mulund, Powai, Bandra, Andheri, and Navi Mumbai. Split fares with verified co-passengers and save up to 50%.",
  applicationName: "FlightPool",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlightPool",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoActive = isDemoMode();

  return (
    <html lang="en" className="h-full antialiased" data-demo-mode={demoActive ? "true" : "false"}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-100 font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
