import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";

export const dynamic = "force-dynamic";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const walletAddress = (session as any)?.user?.walletAddress ?? (session as any)?.user?.address ?? (session as any)?.user?.id ?? "unknown";

    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("image") || null) as File | null;
    if (!file) return NextResponse.json({ error: "file (form field 'file' or 'image') is required" }, { status: 400 });

    const ext = String(file.name).split(".").pop() || "bin";
    const filename = `${walletAddress}_avatar.${ext}`;

    const uploadRes = await pinata.upload.file(file, {
      metadata: {
        name: filename,
        keyValues: {
          walletAddress,
          originalFilename: file.name,
        },
      },
    });

    const resAny = uploadRes as any;
    const hash = resAny?.IpfsHash || resAny?.Hash || resAny?.hash;
    if (!hash) return NextResponse.json({ error: "pinata returned no hash", details: uploadRes }, { status: 500 });

    const gateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
    const url = `${gateway}/ipfs/${hash}`;

    return NextResponse.json({ success: true, hash, url, filename }, { status: 200 });
  } catch (err) {
    console.error("upload-avatar error:", err);
    return NextResponse.json({ error: "internal error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}