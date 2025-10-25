"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";

type PostModel = {
  _id?: string;
  title?: string;
  body?: string;
  author?: any;
  [key: string]: any;
};

export default function PostPage() {
  const [user, setUser] = useState<any>(null);
  const params = useParams() as { id?: string } | null;
  const id = params?.id ?? "";
  const [post, setPost] = useState<PostModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // derive wallet address from user object (adjust property name if your user uses a different key)
  const walletAddr = user?.walletAddr ?? user?.walletAddress ?? null;

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!mounted) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json().catch(() => null);
        setPost(data?.data ?? data);
      } catch (err) {
        console.error("fetch post error:", err);
        setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white">
        <Header />
        <main className="max-w-3xl mx-auto px-4 pb-12">
          <div className="py-20 text-center text-gray-400">Loading…</div>
        </main>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white">
        <Header />
        <main className="max-w-3xl mx-auto px-4 pb-12">
          <div className="py-20 text-center text-gray-400">Post not found</div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <Header />

      <main className="max-w-3xl mx-auto px-4 pb-12">
        {/* Banner + avatar wrapper (continuous visual) */}
        <div className="relative mt-4">
          {/* Banner: rounded top only */}
          <div className="h-44 w-full bg-gradient-to-r from-gray-800 to-gray-900 rounded-t-lg overflow-hidden flex items-center justify-center border border-gray-800 border-b-0">
            {user?.bannerPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.bannerPhoto} alt="banner" className="w-full h-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="https://images.pexels.com/photos/255379/pexels-photo-255379.jpeg" alt="placeholder" className="w-full h-full object-cover" />
            )}
          </div>

          {/* Profile photo centered and overlapping border between banner and info */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full -translate-y-1/2">
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
              <div className="w-28 h-28 rounded-full border-4 border-gray-900 bg-gray-700 flex items-center justify-center text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Info panel pulled up to touch the banner (no gap) */}
        <section className="-mt-14 bg-gray-900 border border-gray-800 rounded-b-lg p-4 shadow-sm">
          <div className="text-center mt-1">
            <h2 className="text-2xl font-semibold">{user.name}</h2>
            <div className="mt-1 text-sm text-gray-400">
              {user?.username ? `@${user.username}` : "@"}
            </div>

            <div className="mt-3 text-sm text-gray-300">
              {user?.bio ?? "No bio yet."}
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="text-xs text-gray-400">Solana Wallet Address</div>
              <div className="text-sm font-mono text-white">
                {walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : "Not connected"}
              </div>

              <div className="mt-3 flex gap-3 flex-wrap justify-center">
                {user?.website && (
                  <a href={user.website} target="_blank" rel="noreferrer" className="text-sm text-[#61dafb] hover:underline">
                    Website
                  </a>
                )}
                {user?.location && <div className="text-sm text-gray-400">{user.location}</div>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-center gap-3">
            <button className="px-4 py-2 bg-[#1976D2] text-white rounded hover:bg-[#00BCD4]">Follow</button>
          </div>
        </section>
      </main>
    </div>
  );
}