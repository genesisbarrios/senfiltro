"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";

interface UserProfile {
  username?: string;
  avatarCID?: string;
}

interface HeaderProps {
  onAccountChange?: (account: string | null) => void;
  profile?: UserProfile;
}

export default function Header({ onAccountChange, profile }: HeaderProps) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onAccountChange?.(publicKey?.toBase58() ?? null);
  }, [publicKey, onAccountChange]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const account = publicKey?.toBase58() ?? null;
  const displayName = profile?.username || (account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null);
  const avatarUrl = profile?.avatarCID ? `https://ipfs.io/ipfs/${profile.avatarCID}` : null;

  return (
    <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#121212]">
      <Link href="/">
        <Image src="/logo.png" alt="Senfiltro Logo" width={120} height={40} />
      </Link>

      <nav className="flex gap-4 items-center">
        {/* WalletMultiButton (keeps default UI & modal) */}
        <WalletMultiButton className="bg-[#1976d2] text-white px-4 py-2 rounded hover:bg-[#00BCD4] transition" />

        {/* Dropdown with extra links and an explicit "Change wallet" action that opens the modal */}
        <div ref={menuRef} className="relative ml-2">
          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="px-2 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
            aria-expanded={menuOpen}
            aria-label="more"
          >
            ⋯
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded shadow-lg z-50">
              <Link href="/profile" className="block px-4 py-2 text-white hover:bg-gray-800">
                Profile
              </Link>
              <a href="https://docs.solana.com" target="_blank" rel="noreferrer" className="block px-4 py-2 text-white hover:bg-gray-800">
                Solana Docs
              </a>
            </div>
          )}
        </div>

        {/* optional avatar/display */}
        {displayName && (
          <div className="flex items-center gap-2 ml-2">
            {avatarUrl && (
              <Image src={avatarUrl} alt="avatar" width={28} height={28} className="rounded-full" />
            )}
            {/* <span className="text-white text-sm font-medium">{displayName}</span> */}
          </div>
        )}
      </nav>
    </header>
  );
}