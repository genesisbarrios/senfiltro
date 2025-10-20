"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { web3Accounts, web3Enable, isWeb3Injected } from "@polkadot/extension-dapp";

interface UserProfile {
  username?: string;
  avatarCID?: string;
}

interface HeaderProps {
  onAccountChange?: (account: string | null) => void;
  profile?: UserProfile; // optional, pass fetched user profile
}

export default function Header({ onAccountChange, profile }: HeaderProps) {
  const [account, setAccount] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkExtension() {
      if (!isWeb3Injected) return;
      const extensions = await web3Enable("Senfiltro");
      if (extensions.length === 0) return;
      const accounts = await web3Accounts();
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
        onAccountChange?.(accounts[0].address);
      }
    }
    checkExtension();

    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onAccountChange]);

  const handleConnect = async () => {
    if (!isWeb3Injected) return alert("Please install Polkadot.js Extension!");
    const extensions = await web3Enable("Senfiltro");
    if (extensions.length === 0) return alert("Please allow access in Polkadot.js Extension!");
    const accounts = await web3Accounts();
    if (accounts.length === 0) return alert("No accounts found in Polkadot.js Extension.");
    setAccount(accounts[0].address);
    onAccountChange?.(accounts[0].address);
  };

  const handleLogout = () => {
    setAccount(null);
    onAccountChange?.(null);
    setDropdownOpen(false);
  };

  const displayName = profile?.username || (account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null);
  const avatarUrl = profile?.avatarCID ? `https://ipfs.io/ipfs/${profile.avatarCID}` : null;

  return (
    <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#121212]">
      {/* Logo */}
      <Link href="/">
        <Image src="/logo.png" alt="Senfiltro Logo" width={120} height={40} />
      </Link>

      <nav className="flex gap-4 items-center relative">
        {!account ? (
          <button
            style={{ backgroundColor: "#1976D2" }}
            className="text-white px-4 py-2 rounded hover:bg-[#00BCD4] transition"
            onClick={handleConnect}
          >
            Connect Wallet
          </button>
        ) : (
          <div ref={dropdownRef} className="relative">
            <div
              className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded cursor-pointer hover:bg-gray-800 transition"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {avatarUrl && (
                <Image
                  src={avatarUrl}
                  alt="avatar"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span className="text-white text-sm font-medium">{displayName}</span>
            </div>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-gray-900 border border-gray-700 rounded shadow-lg z-50">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-white hover:bg-gray-800 transition"
                  onClick={() => setDropdownOpen(false)}
                >
                  Profile
                </Link>
                <button
                  className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 transition"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
