import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RokuLAN",
  description: "A responsive web remote for controlling Roku devices on your local network.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
