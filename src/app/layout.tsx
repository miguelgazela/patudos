import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { Toaster } from "@/components/ui/toast";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Patudos",
  description:
    "Saúde, lembretes, despesas e documentos dos teus animais de estimação.",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Patudos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B6B5F",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <OfflineBanner />
        {children}
        <Toaster />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
