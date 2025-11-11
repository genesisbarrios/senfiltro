"use client"
import { useEffect, useState } from "react"
import Header from "@/components/Header"
import FeedTabs from "@/components/FeedTabs"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRef } from "react";

interface Post {
  _id: string;
  author: string;
  text: string;
  mediaName?: string;
  mediaUrl?: string;
  mediaType?: string; // "image" | "video" | "audio" | "unknown"
  metadataUrl?: string; // <-- added to keep metadata-only reference
  createdAt: string;
}

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

  function buildIpfsUrl(candidate: string): string | undefined {
    if (!candidate) return undefined;
    const s = String(candidate).trim();
    // already full url
    if (s.startsWith("http://") || s.startsWith("https://")) {
      // normalize to ipfs.io if it points at a pinata gateway
      try {
        const u = new URL(s);
        if (u.hostname.includes("pinata.cloud") || u.hostname.endsWith(".mypinata.cloud")) {
          u.hostname = "ipfs.io";
          return u.toString();
        }
      } catch {
        // fall through to return original
      }
      return s;
    }
    // ipfs://CID/path
    if (s.startsWith("ipfs://")) {
      const after = s.replace(/^ipfs:\/\//, "");
      return `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io"}/ipfs/${after}`;
    }
    // /ipfs/CID or ipfs/CID or plain cid
    const m = s.match(/(?:\/?ipfs\/)?([A-Za-z0-9]+.*)/);
    if (m) {
      const cid = m[1];
      return `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io"}/ipfs/${cid}`;
    }
    // hostname/path like mycustom.mypinata.cloud/ipfs/CID -> ensure https:// and route to ipfs.io
    if (/^[^\/]+\.[^\/]+/.test(s)) {
      try {
        const maybe = s.startsWith("https://") || s.startsWith("http://") ? s : `https://${s}`;
        const u = new URL(maybe);
        if (u.hostname.includes("pinata.cloud") || u.hostname.endsWith(".mypinata.cloud")) {
          // convert to ipfs.io keeping the path
          return `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io"}${u.pathname}${u.search}`;
        }
        return maybe;
      } catch {
        return `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io"}/ipfs/${s}`;
      }
    }
    return s;
  }

  // helper to force any gateway.pinata / mypinata host -> ipfs.io for client usage
  function forceIpfsIo(url?: string | null | undefined) {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      if (u.hostname.includes("pinata.cloud") || u.hostname.endsWith(".mypinata.cloud")) {
        u.hostname = "ipfs.io";
        return u.toString();
      }
      return u.toString();
    } catch {
      // fallback string replacement
      return String(url).replace(/gateway\.pinata\.cloud/g, "ipfs.io");
    }
  }

  async function fetchPostsFromIpfs() {
  try {
    const res = await fetch("/api/pinata/get-posts?pageLimit=50&maxResults=200&nameHint=metadata&debug=1", { cache: "no-store" });
    if (!res.ok) {
      console.warn("/api/pinata/get-posts failed", res.status);
      return [];
    }
    const json = await res.json().catch(() => null);
    if (!json || !Array.isArray(json.results)) {
      console.warn("/api/pinata/get-posts returned unexpected shape", json);
      return [];
    }
    console.log(json.results);

    const out: Post[] = json.results.map((r: any) => {
      const meta = r.metadata ?? {};
      const text = String(meta.post_text ?? meta.postText ?? meta.text ?? meta.description ?? "") || "";
      const author = meta.author ?? meta.authorPubkey ?? meta.username ?? "unknown";
      const createdAt = meta.created_at ? new Date(Number(meta.created_at) * 1000).toISOString() : meta.createdAt ?? new Date().toISOString();
      const mediaUrl = forceIpfsIo(r.mediaUrl ?? undefined);
      const mediaType = r.mediaType ?? undefined;

      const mediaName = r.mediaFilename ?? meta.media?.filename ?? meta.media?.name ?? undefined;

      return {
        _id: r.metadataCid ?? r.metadataUrl ?? meta.hash ?? meta.metadata_cid ?? `${Date.now()}_${Math.random()}`,
        author: String(author),
        text,
        mediaName,
        mediaUrl,
        mediaType,
        createdAt,
      } as Post;
    });

    if (out.length === 0) console.info("list-posts returned 0 items");
    return out;
  } catch (err) {
    console.error("fetchPostsFromIpfs error:", err);
    return [];
  }
}

async function loadAndSetPosts(setPosts: (fn: (p: Post[]) => Post[]) => void) {
  try {
    const fetched = await fetchPostsFromIpfs();
    setPosts(() => fetched);
  } catch (err) {
    console.error("loadAndSetPosts failed:", err);
  }
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState("feed")
  const [createOpen, setCreateOpen] = useState(false);
  const [user, setUser] = useState<UserModel | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const { publicKey } = useWallet();

  // getPublicKey should return the wallet string if you have it in client state
  async function getPublicKey(): Promise<string | null> {
    const provider = (window as any).solana;
    return provider?.publicKey?.toString?.() ?? null;
  }

  useEffect(() => {
    loadAndSetPosts(setPosts).catch((e) => console.error("initial loadAndSetPosts failed:", e));
  }, [activeTab]);

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

  async function handleCreate(payload: { text: string; mediaFile?: File | null }) {
    let uploadedUrl: string | undefined = undefined;
    let metadataUrl: string | undefined = undefined;

    try {
      const fd = new FormData();

      // attach media if present
      if (payload.mediaFile) {
        fd.append("mediaFile", payload.mediaFile);
        const mime = payload.mediaFile.type || "";
        const mediaType = mime.startsWith("image")
          ? "image"
          : mime.startsWith("video")
          ? "video"
          : mime.startsWith("audio")
          ? "audio"
          : "unknown";
        fd.append("mediaType", mediaType);
      } else {
        // explicit marker so server knows no file was uploaded
        fd.append("mediaType", "none");
      }

      // build metadata
      const provider = (window as any).solana;
      const authorPubkey = provider?.publicKey?.toString?.() ?? publicKey?.toString?.() ?? "unknown";
      const metadata = {
        author: (username || user?.username) ?? authorPubkey,
        authorPubkey,
        title: payload.text ? String(payload.text).slice(0, 64) : "post",
        postText: payload.text ?? "",
        ai_generated: false,
        extra: {},
      };
      fd.append("metadata", JSON.stringify(metadata));
      fd.append("postText", payload.text ?? "");

      console.log("handleCreate: sending upload", { hasMedia: !!payload.mediaFile, metadata });

      const res = await fetch("/api/pinata/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("upload failed", json);
      } else {
        // prefer media url, otherwise fallback to metadata url
        uploadedUrl =
          json?.data?.media?.url ??
          json?.data?.mediaUrl ??
          (json?.data?.media?.hash ? `https://ipfs.io/ipfs/${json.data.media.hash}` : undefined);

        metadataUrl =
          json?.data?.metadata?.url ??
          (json?.data?.metadata?.hash ? `https://ipfs.io/ipfs/${json.data.metadata.hash}` : undefined);
      }
    } catch (err) {
      console.error("upload error", err);
    }

    const newPost: Post = {
      _id: String(Date.now()),
      author: user?.username ?? user?.walletAddress ?? publicKey?.toString() ?? "unknown",
      text: payload.text,
      // only treat as media when uploadedUrl (actual media) exists
      mediaName: uploadedUrl ? uploadedUrl.split("/").pop() : undefined,
      mediaUrl: uploadedUrl ?? undefined,
      mediaType: uploadedUrl ? (payload.mediaFile?.type?.split("/")[0] ?? undefined) : undefined,
      // keep metadata url separate so UI can choose whether to show it
      metadataUrl: metadataUrl ?? undefined,
      createdAt: new Date().toISOString(),
    };

    setPosts((p) => [newPost, ...p]);
  }

  return (
    <>
    <Header />
    <div className="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6">
      <FeedTabs onTabChange={setActiveTab} />
      <div>
         <button
          onClick={() => setCreateOpen(true)}
          className="w-3/4 mx-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#1976D2] text-white rounded mb-4 hover:bg-[#00BCD4] transition"
          aria-label="Create Post"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M17.414 2.586a2 2 0 0 0-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 0 0 0-2.828z" />
            <path d="M2 15.25V18h2.75l8.486-8.486-2.75-2.75L2 15.25z" />
          </svg>

          <span className="font-medium">Create Post</span>
        </button>

        {posts.map((post) => (
          <PostCard key={post._id} post={post} />
        ))}
      </div>

      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
    </>
  )
}