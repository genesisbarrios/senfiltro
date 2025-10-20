"use client"
import { useState } from "react"

export default function FeedTabs({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const [active, setActive] = useState("feed")

  const handleClick = (tab: string) => {
    setActive(tab)
    onTabChange(tab)
  }

  return (
    <div className="flex justify-around border-b border-gray-800 mb-4">
      {["feed", "following"].map(tab => (
        <button
          key={tab}
          onClick={() => handleClick(tab)}
          className={`w-1/2 py-3 text-center capitalize ${active === tab ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400"}`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
