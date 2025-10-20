import "./globals.css"
import { ReactNode } from "react"

export const metadata = {
  title: "Senfiltro",
  description: "Unfiltered social dApp built on Polkadot",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans">
        {children}
      </body>
    </html>
  )
}
