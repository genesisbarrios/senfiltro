"use client"
import { useEffect, useState } from "react"
import Header from "@/components/Header"
import FeedTabs from "@/components/FeedTabs"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"

interface Post {
  _id: string
  author: string
  text: string
  mediaName?: string
  createdAt: string
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState("feed")
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    setPosts([
      {
        _id: "1",
        author: "0xAbC...123",
        text: "Welcome to Senfiltro ✨ Speak freely, stay on-chain.",
        createdAt: new Date().toISOString(),
      },
      {
        _id: "2",
        author: "0xDeF...456",
        text: "This is a test post with media!",
        mediaName: "sample.jpg",
        createdAt: new Date().toISOString(),
      },
    ])
  }, [activeTab])

  async function handleCreate(payload: { text: string; mediaFile?: File | null }) {
    // replace with real upload/tx logic (upload mediaFile to IPFS and store CID on-chain)
    const newPost: Post = {
      _id: String(Date.now()),
      author: "you",
      text: payload.text,
      mediaName: payload.mediaFile?.name,
      createdAt: new Date().toISOString(),
    }
    setPosts((p) => [newPost, ...p])
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Header />
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
  )
}