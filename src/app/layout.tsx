import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "شهریار | دستیار هوشمند شهر رفسنجان",
  description:
    "شهریار؛ اپلیکیشن هوشمند شهر رفسنجان با دستیار هوش مصنوعی هوشیار، مدیریت اهداف، دایرکتوری اصناف و خدمات شهری آنلاین",
  keywords: [
    "شهریار",
    "رفسنجان",
    "هوش مصنوعی",
    "هوشیار",
    "خدمات شهری",
    "اصناف رفسنجان",
    "شهر هوشمند",
  ],
  authors: [{ name: "شهریار" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "شهریار | دستیار هوشمند شهر رفسنجان",
    description: "همراه هوشمند شهروندان رفسنجان",
    siteName: "شهریار",
    type: "website",
    locale: "fa_IR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2450d8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1428" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
