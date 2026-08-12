import { cn } from "@sugt/ui/lib/utils";
import type { Metadata } from "next";

import "@sugt/ui/globals.css";
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
    /* Montserrat is loaded here rather than in `@sugt/ui`: `next/font` self-hosts it and
       belongs to the app that renders `<html>`. `.dark` belongs on this element for the
       same reason, and is deliberately not set — `@sugt/ui` ships the token block and
       the `dark` variant, and no surface asks for the class yet. See
       `packages/ui/README.md`. */
    <html
      lang="id"
      className={cn("h-full", "antialiased", "font-sans", sans.variable)}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
