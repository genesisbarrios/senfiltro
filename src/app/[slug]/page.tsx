import { notFound } from "next/navigation";
import Header from "../../components/Header";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Props = {
  params: {
    slug: string;
  };
};

type UserModel = {
  name?: string;
  username?: string;
  bio?: string;
  profilePhoto?: string | null;
  bannerPhoto?: string | null;
  walletAddress?: string;
  website?: string;
  location?: string;
  [key: string]: any;
};


export default async function UserPage({ params }: Props) {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const [user, setUser] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState(true);
  const { publicKey } = useWallet();
  const walletAddr = user?.walletAddress ?? publicKey?.toBase58() ?? null;
  const displayName = user?.name ?? user?.username ?? "Unknown user";

  if (!base) {
    console.error("NEXT_PUBLIC_BASE_URL is not set");
    return notFound();
  }

  try {
    const res = await fetch(`${base}/api/users`, { cache: "no-store" });
    if (!res.ok) {
      console.error("Failed to fetch users:", res.status);
      return notFound();
    }

    const users = await res.json();
    if (!Array.isArray(users)) {
      console.error("Users response is not an array");
      return notFound();
    }

    const user = users.find((u: any) => String(u?.username) === params.slug);
    if (!user) return notFound();

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
                  <img
                    src={user.bannerPhoto}
                    alt="banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500"><img src="https://images.pexels.com/photos/255379/pexels-photo-255379.jpeg" alt="placeholder" className="w-full h-full object-cover" /></div>
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
                <h2 className="text-2xl font-semibold">{displayName}</h2>
                <div className="mt-1 text-sm text-gray-400">
                  {user?.username ? `@${user.username}` : loading ? <span>Loading username…</span> : "@"}
                </div>
    
                <div className="mt-3 text-sm text-gray-300">
                  {user?.bio ?? (loading ? "Loading bio…" : "No bio yet.")}
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
                {/* <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">Message</button> */}
              </div>
            </section>
          </main>
        </div>
    );
  } catch (err) {
    console.error("UserPage error:", err);
    return notFound();
  }
}