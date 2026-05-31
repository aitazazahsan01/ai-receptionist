import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Receptionist Dashboard",
  description: "Live calls, call history, and booking analytics",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-foreground/10 px-8 py-4 flex gap-6 text-sm">
          <Link href="/" className="font-semibold">
            AI Receptionist
          </Link>
          <Link href="/live" className="hover:underline">
            Live
          </Link>
          <Link href="/calls" className="hover:underline">
            Calls
          </Link>
          <Link href="/analytics" className="hover:underline">
            Analytics
          </Link>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
