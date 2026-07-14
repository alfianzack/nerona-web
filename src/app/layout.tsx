import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nerona Metadata",
  description: "License management and orders for the Nerona Metadata extension.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
