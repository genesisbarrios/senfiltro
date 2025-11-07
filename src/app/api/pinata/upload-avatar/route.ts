import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

function extractCid(val: any): string | null {
  if (!val) return null;
  const s = String(val);
  const m = s.match(/\/ipfs\/([^/?#]+)/);
  if (m) return m[1];
  const m2 = s.match(/(Qm[1-9A-HJ-NP-Za-z]{44,}|baf[0-9a-z]{40,})/i);
  if (m2) return m2[1];
  if (/^[A-Za-z0-9]+$/.test(s)) return s;
  return null;
}

async function unpinCid(cid: string) {
  if (!cid) return;
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    console.warn("PINATA_JWT not set, cannot unpin", cid);
    return;
  }
  try {
    const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("unpinCid failed", cid, res.status, text);
    } else {
      console.log("unpinCid success", cid);
    }
  } catch (err) {
    console.warn("unpinCid error", String(err));
  }
}

export async function POST(req: Request) {
  try {
    // parse form data early
    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("image") || null) as File | null;
    if (!file) return NextResponse.json({ error: "file (form field 'file' or 'image') is required" }, { status: 400 });

    if (!file.type?.startsWith?.("image/")) {
      return NextResponse.json({ error: "only image files are allowed" }, { status: 400 });
    }

    // fallback identifiers: form field or header if session unavailable
    const userIdFromForm = (formData.get("userId") || formData.get("wallet") || formData.get("walletAddress") || null) as string | null;
    const headerPubkey = (req as any).headers?.get?.("x-solana-pubkey") ?? (req as any).headers?.get?.("x-wallet") ?? null;

    const userId =
      userIdFromForm ||
      headerPubkey ||
      "unknown";

    const ext = String(file.name).split(".").pop() || "png";
    const filename = `${userId}_avatarImage.${ext}`;

    const uploadRes = await pinata.upload.file(file, {
      metadata: { name: filename },
    });

    const resAny = uploadRes as any;
    const hash = resAny?.IpfsHash || resAny?.Hash || resAny?.hash;
    if (!hash) return NextResponse.json({ error: "pinata returned no hash", details: uploadRes }, { status: 500 });

    const gateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
    let url = `${gateway}/ipfs/${hash}`;

    // HEAD-check gateway and fallback (keep behavior from previous changes)
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) url = `https://ipfs.io/ipfs/${hash}`;
    } catch {
      url = `https://ipfs.io/ipfs/${hash}`;
    }

    // try saving to user doc, unpin previous image if present; still return upload success if DB fails
    try {
      await connectMongo();

      const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(userId));
      let userDoc: any = null;

      if (isObjectId) {
        userDoc = await User.findById(String(userId));
      }
      if (!userDoc && userId !== "unknown") {
        userDoc = await User.findOne({ walletAddress: String(userId) });
      }

      // unpin previous avatar/image if present and different
      if (userDoc) {
        const prev = userDoc.image ?? userDoc.profilePhoto ?? null;
        const prevCid = extractCid(prev);
        if (prevCid && prevCid !== hash) {
          // best-effort unpin; don't block on failure
          unpinCid(prevCid).catch((e) => console.warn("unpin previous avatar failed", e));
        }
        userDoc.image = hash;
        await userDoc.save();
      } else if (userId !== "unknown") {
        const newUser = new User({
          walletAddress: String(userId),
          image: hash,
        });
        await newUser.save();
        userDoc = newUser;
      }

      return NextResponse.json(
        {
          success: true,
          hash,
          url,
          filename,
          user: userDoc ? { id: userDoc._id, walletAddress: userDoc.walletAddress, profilePhoto: userDoc.profilePhoto } : undefined,
        },
        { status: 200 }
      );
    } catch (dbErr) {
      console.error("upload-avatar: failed to save user url", dbErr);
      return NextResponse.json({ success: true, hash, url, filename, warning: "uploaded but failed to save user record", detail: String(dbErr) }, { status: 200 });
    }
  } catch (err) {
    console.error("upload-avatar error:", err);
    return NextResponse.json({ error: "internal error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}