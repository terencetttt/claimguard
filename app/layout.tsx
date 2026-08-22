import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletModal } from "@/components/wallet-control";
import { WalletProvider } from "@/components/wallet-provider";
import { ClaimsProvider } from "@/components/claims-provider";
import { DecisionsProvider } from "@/components/decisions-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ClaimGuard", template: "%s · ClaimGuard" },
  description: "Evidence-led insurance claim resolution.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full"><WalletProvider><ClaimsProvider><DecisionsProvider>{children}</DecisionsProvider></ClaimsProvider><WalletModal/></WalletProvider></body>
    </html>
  );
}
