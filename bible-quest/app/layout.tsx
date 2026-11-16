import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bible Quest",
  description: "Gamified tracker for the mons game bible",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
