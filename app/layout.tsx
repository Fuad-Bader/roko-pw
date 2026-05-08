import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { VaultProvider } from "./components/VaultProvider";
import { ThemeProvider } from "./components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "RokoPW – Zero-Trust Password Manager",
  description:
    "A zero-trust password manager. All encryption happens in your browser with AES-256-GCM. The server never sees your passwords.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-accent="violet"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-primary text-primary">
        <ThemeProvider>
          <VaultProvider>{children}</VaultProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
