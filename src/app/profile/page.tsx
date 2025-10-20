"use client";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Example: fetch current user
    fetch("/api/users").then(res => res.json()).then(data => setUser(data[0]));
  }, []);

  if (!user) return <p style={{textAlign:"center", marginTop:"20%"}}>Loading...</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <img
        src={user.profilePhoto || "/default-avatar.png"}
        className="w-24 h-24 rounded-full mb-4"
      />
      <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
      <p className="text-gray-400">{user.bio}</p>
      <button className="mt-4 bg-senfiltro-blue px-4 py-2 rounded">Edit Profile</button>
    </div>
  );
}
