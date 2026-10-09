import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlightPool • मुंबई एयरपोर्ट कैब शेयरिंग | Mumbai Airport Cab Sharing",
  description:
    "Share a cab from Mumbai Airport (BOM T1 & T2) to Thane, Mulund, Powai, Bandra, Andheri, Navi Mumbai. Split fare with verified flight passengers & save up to 50%.",
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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-100 font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
