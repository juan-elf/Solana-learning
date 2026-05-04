import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SolanaWalletProvider from "@/components/WalletProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aqueduct — DCA vault on Solana",
  description: "Non-custodial multi-pair DCA vault on Solana. Stream SOL into JUP, USDC, BONK, WIF and more with on-chain slippage and allocation caps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-slate-950 text-white antialiased">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
