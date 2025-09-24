import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShikAI - Web Interface",
  description: "AI Assistant with full computer access - Web Interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
