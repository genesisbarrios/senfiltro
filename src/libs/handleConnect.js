"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import bs58 from "bs58";

export default function ConnectWalletPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const callback = params?.get("callback") ?? "/";

  async function handleConnect() {
    setError(null);
    setLoading(true);

    try {
      const provider = (window).solana;
      if (!provider || !provider.isPhantom) {
        setError("Phantom wallet not found");
        setLoading(false);
        return;
      }

      await provider.connect();
      const pubkey = provider.publicKey?.toString();
      if (!pubkey) throw new Error("No public key after connect");

      const messageObj = { action: "login", ts: Date.now() };
      const message = JSON.stringify(messageObj);
      const encoded = new TextEncoder().encode(message);

      const signed = await provider.signMessage(encoded, "utf8");
      const sigBytes = (signed).signature ?? signed;
      const signature = bs58.encode(sigBytes);

      const res = await fetch("/api/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-solana-pubkey": pubkey,
          "x-solana-signature": signature,
        },
        body: JSON.stringify({ signedMessage: message }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || JSON.stringify(data));
        setLoading(false);
        return;
      }

      router.push(callback);
    } catch (err) {
      setError(err?.message ?? String(err));
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Connect Wallet</h1>
      <p>Connect with Phantom to sign in. You will be redirected after success.</p>

      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

      <button onClick={handleConnect} disabled={loading} style={{ padding: "8px 16px" }}>
        {loading ? "Connecting..." : "Connect Phantom"}
      </button>

      <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
        If you prefer another wallet provider, adapt this page to use its signMessage/connect API.
      </div>
    </main>
  );
}