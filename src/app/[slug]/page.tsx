import { notFound } from "next/navigation";

export default async function UserPage(props: any): Promise<JSX.Element | null> {
  const params = props?.params ?? {};
  const slug = String(params?.slug ?? "");

  const base = process.env.NEXT_PUBLIC_BASE_URL;
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

    const user = users.find((u: any) => String(u?.username) === slug);
    if (!user) return notFound();

    return (
      <div className="max-w-xl mx-auto p-4">
        <img
          src={user.profilePhoto || "/default-avatar.png"}
          className="w-24 h-24 rounded-full mb-4 object-cover"
          alt={user.displayName || user.username}
          width={96}
          height={96}
        />
        <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
        {user.bio && <p className="text-gray-400 mt-2">{user.bio}</p>}
      </div>
    );
  } catch (err) {
    console.error("UserPage error:", err);
    return notFound();
  }