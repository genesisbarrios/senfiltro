"use client";
import { useState } from "react";

interface SignUpDialogProps {
  account: string;
  onComplete: () => void;
}

export default function SignUpDialog({ account, onComplete }: SignUpDialogProps) {
  const [username, setUsername] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !imageFile) return alert("Username and image required");

    setLoading(true);

    const formData = new FormData();
    formData.append("file", imageFile);

    // Upload to Storacha
    const uploadRes = await fetch("/api/storacha/upload", { method: "POST", body: formData });
    const { cid } = await uploadRes.json();

    // Call API to create on-chain profile
    await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, username, imageCID: cid }),
    });

    setLoading(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
      <div className="bg-senfiltro-bg p-6 rounded-lg w-80">
        <h2 className="text-xl font-bold mb-4 text-senfiltro-lightBlue">Create Your Profile</h2>
        <input
          type="text"
          placeholder="Username"
          className="w-full mb-3 p-2 rounded bg-gray-800 text-senfiltro-lightBlue"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          className="text-sm text-senfiltro-lightBlue"
          onChange={(e) => e.target.files && setImageFile(e.target.files[0])}
        />
        <button
          className="mt-4 w-full bg-senfiltro-blue text-white px-4 py-2 rounded hover:bg-senfiltro-aqua transition"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Saving..." : "Create Profile"}
        </button>
      </div>
    </div>
  );
}
