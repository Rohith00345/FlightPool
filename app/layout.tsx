import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { isDemoMode } from "@/lib/demo";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FlightPool • Night Runway Mumbai Airport Cab Sharing (BOM)",
  description:
    "Share an airport cab from Mumbai Airport (BOM T1 & T2) to Thane, Mulund, Powai, Bandra, Andheri, and Navi Mumbai. Save up to 50% with verified co-passengers.",
  applicationName: "FlightPool",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FlightPool",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070A12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoActive = isDemoMode();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${notoSansDevanagari.variable}`}
      data-demo-mode={demoActive ? "true" : "false"}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={true}
          disableTransitionOnChange={false}
          themes={["dark", "light", "amoled"]}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
