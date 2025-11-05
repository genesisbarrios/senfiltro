"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { set } from "mongoose";
import { faPatreon, faDiscord, faSoundcloud, faBluesky, faBandcamp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


type UserModel = {
  name?: string;
  username?: string;
  bio?: string;
  profilePhoto?: string | null;
  bannerPhoto?: string | null;
  walletAddress?: string;
  website?: string;
  location?: string;
  socials?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    bluesky?: string;
    soundcloud?: string;
    discord?: string;
    patreon?: string;
    bandcamp?: string;
  }
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
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [blueskyHandle, setBlueskyHandle] = useState("");
  const [soundcloudHandle, setSoundcloudHandle] = useState("");
  const [bandcampHandle, setBandcampHandle] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [patreonHandle, setPatreonHandle] = useState("");

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
          setInstagramHandle(json?.data?.socials?.instagram ?? "");
          setTiktokHandle(json?.data?.socials?.tiktok ?? "");
          setYoutubeHandle(json?.data?.socials?.youtube ?? "");
          setBlueskyHandle(json?.data?.socials?.bluesky ?? "");
          setSoundcloudHandle(json?.data?.socials?.soundcloud ?? "");
          setDiscordHandle(json?.data?.socials?.discord ?? "");
          setPatreonHandle(json?.data?.socials?.patreon ?? "");
          setBandcampHandle(json?.data?.socials?.bandcamp ?? "");
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


function buildSocialUrl(platform: string, value?: string) {
  if (!value) return null;
  let v = String(value).trim();
  // already absolute
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("mailto:")) return v;
  // strip leading @
  const handle = v.replace(/^@/, "").trim();

  switch (platform) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "youtube":
      // if user pasted a channel/watch path without protocol, make absolute
      if (handle.includes("channel") || handle.includes("watch") || handle.includes("youtu.be")) {
        return handle.startsWith("http") ? handle : `https://${handle}`;
      }
      return `https://youtube.com/${handle}`;
    case "soundcloud":
      return handle.startsWith("http") ? handle : `https://soundcloud.com/${handle}`;
    case "bandcamp":
      // allow full host or shop name
      if (handle.includes(".")) return handle.startsWith("http") ? handle : `https://${handle}`;
      return `https://${handle}.bandcamp.com`;
    case "patreon":
      return `https://www.patreon.com/${handle}`;
    case "discord":
      // allow invites like "discord.gg/xyz" or full urls or just code
      if (handle.startsWith("discord.gg") || handle.includes("discord.com") || handle.includes("invite")) {
        return handle.startsWith("http") ? handle : `https://${handle}`;
      }
      return `https://discord.gg/${handle}`;
    case "bluesky":
      // prefer bsky.app profile path if a bare handle provided
      if (handle.includes("bsky.app") || handle.includes("bluesky")) {
        return handle.startsWith("http") ? handle : `https://${handle}`;
      }
      return `https://bsky.app/profile/${handle}.bsky.social`;
    default:
      // fallback: make absolute
      return handle.startsWith("http") ? handle : `https://${handle}`;
  }
}

  async function onSave(e?: React.FormEvent) {
    e?.preventDefault();
    setEditing(false);

    // build merged socials array from individual handles + extra list
    const payload = {
      walletAddress: walletAddr ?? undefined,
      name,
      username,
      email,
      bio,
      website,
      instagram: instagramHandle,
      tiktok: tiktokHandle,
      youtube: youtubeHandle,
      bluesky: blueskyHandle,
      soundcloud: soundcloudHandle,
      discord: discordHandle,
      patreon: patreonHandle,
      bandcamp: bandcampHandle
    };

    try {
      // Use wallet-sign flow to authenticate and save
      const result = await signAndSaveProfile(payload);

      // optimistic UI update on success
      setUser((u) => ({ ...(u ?? {}), ...payload}));
      setInstagramHandle(payload.instagram ?? "");
      setTiktokHandle(payload.tiktok ?? "");
      setYoutubeHandle(payload.youtube ?? "");
      setBlueskyHandle(payload.bluesky ?? "");
      setSoundcloudHandle(payload.soundcloud ?? "");
      setDiscordHandle(payload.discord ?? "");
      setPatreonHandle(payload.patreon ?? "");
      setBandcampHandle(payload.bandcamp ?? "");
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
                     <div className="mt-4 flex items-center gap-4">
                  {user?.socials?.instagram ? (
                    <a className="text-pink-400" href={buildSocialUrl("instagram", user.socials.instagram) ?? undefined} target="_blank" rel="noreferrer">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5z"/></svg>
                    </a>
                  ) : null}

                  {user?.socials?.tiktok ? (
                    <a className="text-white" href={buildSocialUrl("tiktok", user.socials.tiktok) ?? undefined} target="_blank" rel="noreferrer">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3v8.5A4.5 4.5 0 0 1 12.5 16 4.5 4.5 0 1 1 13 6.5V3z"/></svg>
                    </a>
                  ) : null}

                  {user?.socials?.youtube ? (
                    <a className="text-red-500" href={buildSocialUrl("youtube", user.socials.youtube) ?? undefined} target="_blank" rel="noreferrer">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.2-3L10 9v6z"/></svg>
                    </a>
                  ) : null}

                  {user?.socials?.bluesky ? (
                    <a className="text-sky-300" href={buildSocialUrl("bluesky", user.socials.bluesky) ?? undefined} target="_blank" rel="noreferrer">
                      <FontAwesomeIcon icon={faBluesky} className="h-6 w-6"/>
                    </a>
                  ) : null}

                  {user?.socials?.discord ? (
                    <a className="text-indigo-500" href={buildSocialUrl("discord", user.socials.discord) ?? undefined} target="_blank" rel="noreferrer">
                      <FontAwesomeIcon icon={faDiscord} className="h-6 w-6"/>
                    </a>
                  ) : null}

                  {user?.socials?.patreon ? (
                    <a className="text-orange-400" href={buildSocialUrl("patreon", user.socials.patreon) ?? undefined} target="_blank" rel="noreferrer">
                      <FontAwesomeIcon icon={faPatreon} className="h-6 w-6"/>
                    </a>
                  ) : null}

                  {user?.socials?.soundcloud ? (
                    <a className="text-orange-500" href={buildSocialUrl("soundcloud", user.socials.soundcloud) ?? undefined} target="_blank" rel="noreferrer">
                      <FontAwesomeIcon icon={faSoundcloud} className="h-6 w-6"/>
                    </a>
                  ) : null}

                  {user?.socials?.bandcamp ? (
                    <a className="text-white" href={buildSocialUrl("bandcamp", user.socials.bandcamp) ?? undefined} target="_blank" rel="noreferrer">
                      <FontAwesomeIcon icon={faBandcamp} className="h-6 w-6"/>
                    </a>
                  ) : null}

                    </div>
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
                <label className="block text-xs text-gray-400 mb-1">Socials</label>
             
             <div className="flex items-center gap-2 mt-4">
               <div className="text-pink-400">
                 <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5z"/></svg>
               </div>
               <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="Instagram handle" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
             </div>

              <div className="flex items-center gap-2 mt-4">
                <div className="text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3v8.5A4.5 4.5 0 0 1 12.5 16 4.5 4.5 0 1 1 13 6.5V3z"/></svg>
                </div>
                <input value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} placeholder="TikTok @handle" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <div className="text-red-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.2-3L10 9v6z"/></svg>
                </div>
                <input value={youtubeHandle} onChange={(e) => setYoutubeHandle(e.target.value)} placeholder="YouTube handle" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>
             
              <div className="flex items-center gap-2 mt-4">
                <div className="text-red-500">
                  <FontAwesomeIcon icon={faBluesky} color="LightSkyBlue" className="h-5 w-5" />  
                </div>
                <input value={blueskyHandle} onChange={(e) => setBlueskyHandle(e.target.value)} placeholder="Bluesky handle" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

              </div>
                <div className="flex items-center gap-2">
                <div className="text-red-500">
                   <FontAwesomeIcon icon={faDiscord} color="purple" className="h-5 w-5" />
                </div>
                <input value={discordHandle} onChange={(e) => setDiscordHandle(e.target.value)} placeholder="Discord Invite (discord.gg/[invite]) or URL" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>      

              <div className="flex items-center gap-2">
                <div className="text-red-500">
                  <FontAwesomeIcon icon={faPatreon} color="white" className="h-5 w-5" />
                </div>
                <input value={patreonHandle} onChange={(e) => setPatreonHandle(e.target.value)} placeholder="Patreon profile" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>
              <div>

              <div className="flex items-center gap-2 mt-4">
                <div className="text-red-500">  
                  <FontAwesomeIcon icon={faSoundcloud} color="orange" className="h-5 w-5" />
                </div>
                <input value={soundcloudHandle} onChange={(e) => setSoundcloudHandle(e.target.value)} placeholder="SoundCloud profile" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <div className="text-red-500">
                  <FontAwesomeIcon icon={faBandcamp} color="white" className="h-5 w-5" />
                </div>
                <input value={bandcampHandle} onChange={(e) => setBandcampHandle(e.target.value)} placeholder="Bandcamp profile" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
              </div>
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