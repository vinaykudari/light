import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Light",
  description: "Clinical trial intelligence from evidence and patient voice",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
