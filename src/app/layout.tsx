import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";

const ui = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const read = Newsreader({
  subsets: ["latin"],
  variable: "--font-read",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Contract Analyser",
  description: "Verified Legal Contract Analysis with strict quote verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${ui.variable} ${read.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F1F0F8] text-[#3B3855]">{children}</body>
    </html>
  );
}
