import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Permit Workflow System",
  description: "Case and task management for environmental review processes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
