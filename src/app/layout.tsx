import "./globals.css"
import { ReactNode } from "react"
import SolanaWalletProvider from "../components/SolanaWalletProvider";
import { Analytics } from "@vercel/analytics/next"

export const metadata = {
  title: "Senfiltro",
  description: "Unfiltered social dApp built on Polkadot",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans">
       <SolanaWalletProvider>
          {children}
            <Analytics />
        </SolanaWalletProvider>
      </body>
    </html>
  )
}
