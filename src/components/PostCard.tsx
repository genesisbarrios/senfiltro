interface Post {
  _id: string
  author: string
  text: string
  mediaCID?: string
  createdAt: string
}

export default function PostCard({ post }: { post: Tweet }) {
  return (
    <div className="border-b border-gray-800 p-4">
      <p className="text-sm text-gray-400">{post.author}</p>
      <p className="text-base mt-1">{post.text}</p>
      {post.mediaCID && (
        <img
          src={`https://ipfs.io/ipfs/${post.mediaCID}`}
          alt="tweet media"
          className="rounded-xl mt-2 max-h-60 object-cover"
        />
      )}
    </div>
  )
}
