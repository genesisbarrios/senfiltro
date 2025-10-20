export default async function PostPage({ params }: { params: { id: string } }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/posts`);
  const posts = await res.json();
  const post = posts.find((p: any) => p.id === params.id);

  if (!post) return <p>Post not found</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-2">{post.content}</h1>
      {post.image && <img src={post.image} className="rounded-lg mt-2" />}
      <div className="text-gray-400 text-sm mt-4">{post.timestamp}</div>
    </div>
  );
}
