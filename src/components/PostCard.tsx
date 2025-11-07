
interface Post {
  _id: string;
  author: string;
  text: string;
  mediaName?: string;
  mediaUrl?: string;
  mediaType?: string; // "image" | "video" | "audio" | "unknown"
  createdAt: string;
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <div className="border-b border-gray-800 p-4">
      <p className="text-sm text-gray-400">{post.author}</p>
      <p className="text-base mt-1">{post.text}</p>
     {typeof post.mediaUrl === "string" && post.mediaUrl.length > 0 && (
        <img
          src={post.mediaUrl}
          alt="post media"
          className="rounded-xl mt-2 max-h-60 object-cover"
        />
      )}
    </div>
  )
}
