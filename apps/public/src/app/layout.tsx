import { cn } from "@sugt/ui/lib/utils";
import type { Metadata } from "next";

import "@sugt/ui/globals.css";
import { Montserrat } from "next/font/google";

const sans = Montserrat({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Beranda",
    template: "%s | SUGT - Sekolah Unggul Garuda Transformasi x DITSAMA ITB",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn("h-full", "antialiased", "font-sans", sans.variable)}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
