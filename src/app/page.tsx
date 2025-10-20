"use client"
import { useEffect, useState } from "react"
import Header from "@/components/Header"
import FeedTabs from "@/components/FeedTabs"
import PostCard from "@/components/PostCard"

interface Post {
  _id: string
  author: string
  text: string
  mediaCID?: string
  createdAt: string
}

export default function HomePage() {
  const [posts, setPosts] = useState<Tweet[]>([])
  const [activeTab, setActiveTab] = useState("feed")

  useEffect(() => {
    // For now: mock feed
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
        mediaCID: "bafkreihdwdce4sampleIPFSHash",
        createdAt: new Date().toISOString(),
      },
    ])
  }, [activeTab])

  return (
    <div className="max-w-2xl mx-auto">
      <Header />
      <FeedTabs onTabChange={setActiveTab} />

      <div>
        {posts.map((post) => (
          <PostCard key={post._id} post={post} />
        ))}
      </div>
    </div>
  )
}
