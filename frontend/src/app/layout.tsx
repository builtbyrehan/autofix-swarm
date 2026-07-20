import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AutoFix Swarm — Autonomous Bug Detection & Remediation",
  description:
    "Three agents. One pipeline. Watcher finds it, Codex fixes it, Reviewer proves it — with no human in the loop.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-[#050505] text-[#fafafa]`}
      >
        {children}
      </body>
    </html>
  );
}
