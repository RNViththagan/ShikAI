import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShikAI - AI Assistant",
  description: "ShikAI - AI Assistant with JSON RPC Streaming Interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="bg-gray-50 text-gray-900 antialiased"
        style={{ backgroundColor: "#f9fafb" }}
      >
        <div className="min-h-screen" style={{ minHeight: "100vh" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
