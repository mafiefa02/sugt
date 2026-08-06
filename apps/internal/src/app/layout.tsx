import { cn } from "-/lib/utils";
import type { Metadata } from "next";

import "-/styles.css";
import { Montserrat } from "next/font/google";

const sans = Montserrat({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Beranda",
    template: "%s | SUGT Internal",
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
