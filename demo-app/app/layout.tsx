import type { Metadata } from "next";
import Providers from "./components/Providers";
import SiteChrome from "./components/SiteChrome";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confidential Compliance — auditor-side AML for Solana CT",
  description:
    "Live agent that consumes solana-confidential-skill and runs its real auditor-side AML engine for Token-2022 Confidential Transfers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300&family=Inter:wght@300;400;500;600&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Montserrat:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteChrome />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
