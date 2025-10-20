"use client";

import { useState } from "react";



export default function MediaUploader({ onApproved }: { onApproved: (url: string, aiTag: boolean, type: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');


const uploadToPinata = async (file:any) => {
    try {
      setUploadProgress('Validating files...');

      // Check file size (limit to 50MB for audio)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error('Audio file too large. Maximum size is 50MB.');
      }

      if (file.type.startsWith("image") && file.size > 10 * 1024 * 1024) { // 10MB for images
        throw new Error('Image file too large. Maximum size is 10MB.');
      }

      setUploadProgress('Preparing upload data...');
      
      const formData = new FormData();
      formData.append('file', file);
      
      const metadata = {
        filename: file.name,
        fileType: file.type,
        userId: session?.user?.id
      };
      
      console.log('📤 Uploading with metadata:', metadata);
      formData.append('metadata', JSON.stringify(metadata));

      setUploadProgress('Uploading to IPFS...');
      
      const response = await apiClient.post('/pinata/upload-single', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('📡 Full response object:', response);
      console.log('📡 Response data:', response.data);

      // FIX: The response.data IS the actual data, not a wrapper
      // The API client already unwraps the response for us
      if (!response.data) {
        throw new Error('No response data received');
      }

      // The response.data contains the actual track data, which means success
      console.log('✅ IPFS upload successful:', response.data);
      setUploadProgress('IPFS upload completed successfully!');
      
      // Return the actual data (response.data IS the data)
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Error in uploadSingleTrack:', error);
      setUploadProgress('');
      throw new Error(error.message || 'Upload failed');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const tempUrl = URL.createObjectURL(file);

    setError(null);
    setLoading(true);

    try {
      // 1️⃣ Moderate file
      const res = await fetch("/api/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: tempUrl, fileType }),
      });

      const data = await res.json();

      if (data.isSensitive) {
        setError("❌ This file contains sensitive or restricted content and cannot be uploaded.");
        setLoading(false);
        return;
      }

      // 2️⃣ Upload to Pinata
      const uploadRes = await uploadToPinata(file); // implement your upload

      // 3️⃣ Notify parent
      onApproved(uploadRes.url, data.isAIGenerated, fileType);
    } catch (err) {
      console.error(err);
      setError("Something went wrong during upload.");
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={handleFileChange}
        disabled={loading}
      />
      {loading && <p className="text-sm text-gray-400">Checking media...</p>}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
