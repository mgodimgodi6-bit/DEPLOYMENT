import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Briiz AI — Advanced Business Intelligence",
  description:
    "Your elite AI advisor for finance, law, entrepreneurship, and strategy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
