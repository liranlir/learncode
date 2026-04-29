import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeLens - AI Code Learning",
  description: "A browser-first AI assistant for learning code from local files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
