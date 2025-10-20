

export default async function UserPage({ params }: { params: { slug: string } }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users`);
  const users = await res.json();
  const user = users.find((u: any) => u.username === params.slug);
  if (!user) return (<>Not found...</>)

  return (
    <div className="max-w-xl mx-auto p-4">
      <img
        src={user.profilePhoto || "/default-avatar.png"}
        className="w-24 h-24 rounded-full mb-4"
      />
      <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
      <p className="text-gray-400">{user.bio}</p>
    </div>
  );
}
