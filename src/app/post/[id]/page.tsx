"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PostModel = {
  id?: string;
  content?: string;
  image?: string;
  timestamp?: string;
  [key: string]: any;
};
export default function PostPage(): React.ReactElement {
  const params = useParams() as { id?: string } | null;
  const id = params?.id ?? "";
  const [post, setPost] = useState<PostModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/posts`, { cache: "no-store" });
        if (!mounted) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const posts = await res.json().catch(() => null);
        const found = Array.isArray(posts) ? posts.find((p: any) => String(p.id) === String(id)) : null;
        if (!found) {
          setNotFound(true);
        } else {
          setPost(found);
        }
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

  if (loading) return <div className="max-w-xl mx-auto p-4 text-gray-400">Loading…</div>;
  if (notFound || !post) return <div className="max-w-xl mx-auto p-4 text-gray-400">Post not found</div>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-2">{post.content}</h1>
      {post.image && <img src={post.image} alt="post" className="rounded-lg mt-2" />}
      <div className="text-gray-400 text-sm mt-4">{post.timestamp}</div>
    </div>
  );
}