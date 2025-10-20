import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { fileUrl, fileType } = await req.json();

  if (!fileUrl) {
    return NextResponse.json({ error: "Missing fileUrl" }, { status: 400 });
  }

  // Select which models to run based on file type
  let models = "nudity,wad,offensive,ai-generated";
  if (fileType.startsWith("video")) models = "nudity-2.0,wad,offensive,ai-generated";
  if (fileType.startsWith("audio")) {
    // Skip moderation for now — optional future: detect speech content
    return NextResponse.json({ isSensitive: false, isAIGenerated: false });
  }

  const params = new URLSearchParams({
    url: fileUrl,
    models,
    api_user: process.env.SIGHTENGINE_USER!,
    api_secret: process.env.SIGHTENGINE_SECRET!,
  });

  const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`);
  const data = await res.json();

  if (!data || data.status !== "success") {
    return NextResponse.json({ error: "Sightengine error", data }, { status: 500 });
  }

  const { nudity, offensive, weapon, alcohol, drugs, aigen } = data;

  const isSensitive =
    (nudity?.sexual_activity > 0.3 ||
      nudity?.erotica > 0.5 ||
      offensive?.prob > 0.6 ||
      weapon?.prob > 0.6 ||
      alcohol?.prob > 0.6 ||
      drugs?.prob > 0.6);

  const isAIGenerated = aigen?.ai_generated > 0.6;

  return NextResponse.json({
    isSensitive,
    isAIGenerated,
    moderation: data,
  });
}
