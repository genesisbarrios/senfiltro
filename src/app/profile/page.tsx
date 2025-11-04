"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { set } from "mongoose";

type UserModel = {
  name?: string;
  username?: string;
  bio?: string;
  profilePhoto?: string | null;
  bannerPhoto?: string | null;
  walletAddress?: string;
  website?: string;
  location?: string;
  socials?: string[];
  [key: string]: any;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState(true);
  const { publicKey } = useWallet();

  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [socials, setSocials] = useState<string[]>([]);
  const [newSocial, setNewSocial] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");

  // getPublicKey should return the wallet string if you have it in client state
  async function getPublicKey(): Promise<string | null> {
    const provider = (window as any).solana;
    return provider?.publicKey?.toString?.() ?? null;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const wallet = await getPublicKey();
        const url = wallet ? `/api/get-user?wallet=${encodeURIComponent(wallet)}` : "/api/get-user";
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (!res.ok) {
          console.error("GET /api/get-user failed", json);
          setUser(null);
        } else {
          console.log(json?.data);
          setUser(json?.data ?? null);
          setName(json?.data?.name ?? "");
          setUsername(json?.data?.username ?? "");
          setEmail(json?.data?.email ?? "");
          setBio(json?.data?.bio ?? "");
          setWebsite(json?.data?.website ?? "");
          const sArr = Array.isArray(json?.data?.socials) ? json.data.socials : [];
          setSocials(sArr);
          setInstagramHandle(sArr.find((s: string) => s.toLowerCase().includes("instagram")) ?? "");
          setTiktokHandle(sArr.find((s: string) => s.toLowerCase().includes("tiktok")) ?? "");
          setYoutubeHandle(sArr.find((s: string) => s.toLowerCase().includes("youtube")) ?? "");
        }
      } catch (err) {
        console.error("Failed to load user via api client", err);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const walletAddr = publicKey?.toBase58() ?? user?.walletAddress ?? null;
  const displayName = user?.name ?? user?.username ?? "Unknown user";

  function onEditBannerClick() {
    bannerInputRef.current?.click();
  }

  function onEditInfoClick() {
    // toggle edit mode (info section only)
    setEditing((s) => !s);
  }

  function onBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    console.log("Selected banner file:", f);
    // implement upload flow separately
  }

  // socials helpers
  const getSocial = (keyword: string) => socials.find((s) => s.toLowerCase().includes(keyword)) ?? "";
  const setSocial = (keyword: string, value: string) => {
    setSocials((prev) => {
      const others = prev.filter((s) => !s.toLowerCase().includes(keyword));
      return value.trim() ? [...others, value.trim()] : others;
    });
  };
  function addSocialUrl() {
    if (!newSocial.trim()) return;
    setSocials((s) => [...s, newSocial.trim()]);
    setNewSocial("");
  }
  function removeSocial(idx: number) {
    setSocials((s) => s.filter((_, i) => i !== idx));
  }

    async function signAndSaveProfile(payload: Record<string, any>) {
    setLoading(true);
    try {
      const provider = (window as any).solana;
      if (!provider?.isPhantom) throw new Error("Phantom not available");
      await provider.connect();
      const message = JSON.stringify(payload);
      const encoded = new TextEncoder().encode(message);
      const signed = await provider.signMessage(encoded, "utf8");
      const sigBytes = (signed as any).signature ?? signed;
      const signature = bs58.encode(sigBytes);
      const pubkey = provider.publicKey.toString();

      const res = await fetch("/api/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-solana-pubkey": pubkey,
          "x-solana-signature": signature,
        },
        body: JSON.stringify({ signedMessage: message, ...payload }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || JSON.stringify(data) || "save failed");
      }
      console.log("saved", data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  async function onSave(e?: React.FormEvent) {
    e?.preventDefault();
    setEditing(false);

    // build merged socials array from individual handles + extra list
    const otherSocials = socials.filter((s) =>
      !(
        s.toLowerCase().includes("instagram") ||
        s.toLowerCase().includes("tiktok") ||
        s.toLowerCase().includes("youtube")
      )
    );

    const mergedSocialsArr = [
      ...otherSocials,
      ...(instagramHandle.trim() ? [instagramHandle.trim()] : []),
      ...(tiktokHandle.trim() ? [tiktokHandle.trim()] : []),
      ...(youtubeHandle.trim() ? [youtubeHandle.trim()] : []),
    ];

    // send socials as JSON string (server expects string/array)
    const mergedSocials = JSON.stringify(mergedSocialsArr);

    const payload = {
      walletAddress: walletAddr ?? undefined,
      name,
      username,
      email,
      bio,
      website,
      socials: mergedSocials,
    };

    try {
      // Use wallet-sign flow to authenticate and save
      const result = await signAndSaveProfile(payload);

      // optimistic UI update on success
      setUser((u) => ({ ...(u ?? {}), ...payload, socials: mergedSocialsArr }));
      // keep local socials state in sync
      setSocials(mergedSocialsArr);
      console.log("profile saved result:", result);
    } catch (err) {
      console.error("Failed to save user (wallet-sign) :", err);
    }
  }
  
  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <Header />

      <main className="max-w-3xl mx-auto px-4 pb-12">
        {/* Banner + avatar wrapper (continuous visual) */}
        <div className="relative mt-4">
          {/* Banner: rounded top only */}
          <div className="h-44 w-full bg-gradient-to-r from-gray-800 to-gray-900 rounded-t-lg overflow-hidden flex items-center justify-center border border-gray-800 border-b-0 relative">
            {user?.bannerPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.bannerPhoto} alt="banner" className="w-full h-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="https://images.pexels.com/photos/255379/pexels-photo-255379.jpeg" alt="placeholder" className="w-full h-full object-cover" />
            )}

            {/* Edit icon top-right of banner */}
            <button onClick={onEditBannerClick} className="absolute top-3 right-3 bg-black/60 hover:bg-black/70 text-white p-2 rounded-full border border-gray-700 z-10" aria-label="Edit banner" title="Edit banner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828z" />
                <path d="M2 15.25V18h2.75l8.486-8.486-2.75-2.75L2 15.25z" />
              </svg>
            </button>
          </div>

          {/* Profile photo centered and overlapping border between banner and info */}
        <div className="absolute left-1/2 transform -translate-x-1/2 top-full -translate-y-1/2 z-20">
            <div className="-mt-14">
              {user?.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profilePhoto}
                  alt="profile"
                  className="w-28 h-28 rounded-full border-4 border-gray-900 object-cover bg-gray-700"
                  width={112}
                  height={112}
                />
              ) : (
                <div className="w-28 h-28 relative">
                  <div className="w-28 h-28 rounded-full border-4 border-gray-900 bg-gray-700 flex items-center justify-center text-gray-300 overflow-hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
                    </svg>
                  </div>

                  <button
                    onClick={onEditBannerClick}
                    aria-label="Edit profile photo"
                    title="Edit profile photo"
                    className="absolute left-1/2 transform -translate-x-1/2 translate-y-1/4 bottom-0 bg-black/70 hover:bg-black/80 text-white p-1.5 rounded-full border border-gray-700 z-30"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828z" />
                      <path d="M2 15.25V18h2.75l8.486-8.486-2.75-2.75L2 15.25z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden banner file input */}
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={onBannerFileChange} />

        {/* Info panel pulled up to touch the banner (no gap) */}
        <section className="-mt-8 bg-gray-900 border border-gray-800 rounded-b-lg p-4 shadow-sm relative">
          {/* Edit button top-right inside info box */}
          <button onClick={onEditInfoClick} className="absolute top-3 right-3 bg-black/60 hover:bg-black/70 text-white p-2 rounded-md border border-gray-700" aria-label="Edit profile info" title="Edit profile">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828z" />
              <path d="M2 15.25V18h2.75l8.486-8.486-2.75-2.75L2 15.25z" />
            </svg>
          </button>

          {!editing ? (
            <div className="text-center mt-16">
              <h2 className="text-2xl font-semibold">{displayName}</h2>
              <div className="mt-1 text-sm text-gray-400">{user?.username ? `@${user.username}` : loading ? <span>Loading username…</span> : ""}</div>

              <div className="mt-3 text-sm text-gray-300">{user?.bio ?? (loading ? "Loading bio…" : "No bio yet.")}</div>

              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="text-sm font-mono text-white">{walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : "Not connected"}</div>

                <div className="mt-3 flex gap-3 flex-wrap justify-center">
                  {user?.website && (
                    <a href={user.website} target="_blank" rel="noreferrer" className="text-sm text-[#61dafb] hover:underline">
                       <span className="text-gray-300">
                         {/* globe icon */}
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 9h-2.5a15.9 15.9 0 00-1.1-4.1A8.1 8.1 0 0118.9 11zM12 4c.9 1.6 1.6 3.6 1.9 6H10.1C10.4 7.6 11.1 5.6 12 4zM4.1 11a8.1 8.1 0 012.6-3.1c.4 1.4.6 3 .6 4H4.1zm0 2h2.5c.3 2.4 1 4.4 1.9 6-1-.9-2.2-2.4-3.5-4.1A8.1 8.1 0 004.1 13zM12 20c-.9-1.6-1.6-3.6-1.9-6h3.8c-.3 2.4-1 4.4-1.9 6zm3.3-1.1c1.3 1.7 2.5 3.2 3.5 4.1-.6-.9-1.3-2.1-1.8-3.5-.5-1.1-.9-2.2-1.7-2.6z" /></svg>
                       </span>
                    </a>
                  )}
                  {user?.location && <div className="text-sm text-gray-400">{user.location}</div>}
                  {user?.bio && <div className="text-sm text-gray-400">{user.bio}</div>}
                </div>

                {/* socials icons: instagram, tiktok, youtube displayed */}
                  {user?.socials && (((Array.isArray(user.socials) && user.socials.length > 0) || typeof user.socials === "object")) && (
                    <div className="mt-4 flex items-center gap-4">
                      {(((user?.socials[0] as any))) && (
                        <a
                          className="text-pink-400"
                          href={(user?.socials as any)?.instagramHandle ?? socials.find((s) => s.toLowerCase().includes("instagram")) ?? "#"}
                          aria-label="instagram"
                        >
                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5zm6.8-2.3a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1z"/></svg>
                        </a>
                      )}

                      {(((user?.socials[1] as any))) && (
                        <a
                          className="text-white"
                          href={(user?.socials as any)?.tiktokHandle ?? socials.find((s) => s.toLowerCase().includes("tiktok")) ?? "#"}
                          aria-label="tiktok"
                        >
                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17 3v8.5A4.5 4.5 0 0 1 12.5 16 4.5 4.5 0 1 1 13 6.5V3z"/></svg>
                        </a>
                      )}

                      {(((user?.socials[2] as any))) && (
                        <a
                          className="text-red-500"
                          href={(user?.socials as any)?.youtubeHandle ?? socials.find((s) => s.toLowerCase().includes("youtube")) ?? "#"}
                          aria-label="youtube"
                        >
                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 15l5.2-3L10 9v6zM21.8 8s-.2-1.6-.8-2.3c-.8-.9-1.7-.9-2.1-1C15.7 4.3 12 4.3 12 4.3h-.1s-3.7 0-6.9.4c-.4 0-1.4.1-2.1 1C2.4 6.4 2.2 8 2.2 8S2 9.9 2 11.8v.4C2 14.1 2.2 16 2.2 16s.2 1.6.8 2.3c.8.9 1.9.9 2.4 1 1.7.2 6.9.4 6.9.4s3.7 0 6.9-.4c.4 0 1.4-.1 2.1-1 .6-.7.8-2.3.8-2.3s.2-1.9.2-3.8v-.4c0-1.9-.2-3.8-.2-3.8z"/></svg>
                        </a>
                      )}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <form onSubmit={onSave} className="space-y-4 mt-16">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Username</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white resize-none" rows={3} />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Website</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

                <div>
                <label className="block text-xs text-gray-400 mb-1">E-Mail</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Socials (Instagram / TikTok / YouTube shown)</label>
             <div className="flex items-center gap-2">
               <div className="text-pink-400">
                 <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5z"/></svg>
               </div>
               <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="Instagram handle or URL" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
             </div>

              <div className="flex items-center gap-2">
                <div className="text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3v8.5A4.5 4.5 0 0 1 12.5 16 4.5 4.5 0 1 1 13 6.5V3z"/></svg>
                </div>
                <input value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} placeholder="TikTok @handle or URL" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

              <div className="flex items-center gap-2">
                <div className="text-red-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.2-3L10 9v6z"/></svg>
                </div>
                <input value={youtubeHandle} onChange={(e) => setYoutubeHandle(e.target.value)} placeholder="YouTube channel or URL" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

                {/* <div className="mt-3 flex gap-2">
                  <input value={newSocial} onChange={(e) => setNewSocial(e.target.value)} placeholder="Add another social (https://...)" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
                  <button type="button" onClick={addSocialUrl} className="px-3 py-2 bg-[#1976D2] rounded text-white">Add</button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {socials.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded border border-gray-700">
                      <div className="text-sm text-gray-200 truncate max-w-xs">{s}</div>
                      <button type="button" onClick={() => removeSocial(i)} className="text-xs text-red-400">Remove</button>
                    </div>
                  ))}
                </div> */}
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-800 text-white rounded border border-gray-700">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1976D2] text-white rounded">Save</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}