import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const dynamic = "force-dynamic";

function makeResponse(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

async function parseRequestBody(req: Request): Promise<{ payloadObj: Record<string, any>; signedMessage: string }> {
  // Try JSON first
  try {
    const json = await req.json();
    const signedMessage = typeof json.signedMessage === "string" ? json.signedMessage : JSON.stringify(json);
    return { payloadObj: json, signedMessage };
  } catch {
    // Fallback to formData
    try {
      const form = await req.formData();
      const obj: Record<string, any> = {};
      for (const [k, v] of form.entries()) {
        if (v instanceof File) continue;
        obj[k] = v;
      }
      const signedMessage = typeof obj.signedMessage === "string" ? obj.signedMessage : JSON.stringify(obj);
      return { payloadObj: obj, signedMessage };
    } catch {
      return { payloadObj: {}, signedMessage: "" };
    }
  }
}

function parseSocials(value: any, existing: string[] | undefined) {
  if (!value) return existing ?? [];
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof value === "string") {
    const str = value.trim();
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
      return [String(parsed).trim()];
    } catch {
      if (str.includes(",")) return str.split(",").map(s => s.trim()).filter(Boolean);
      return [str];
    }
  }
  return existing ?? [];
}

export async function POST(req: Request) {
  const { payloadObj, signedMessage } = await parseRequestBody(req);

  // Read signature headers (client must provide these for signature auth)
  const pubkey = (req as any).headers?.get?.("x-solana-pubkey") ?? null;
  const signature = (req as any).headers?.get?.("x-solana-signature") ?? null;

  const ALLOW_NO_AUTH = process.env.ALLOW_NO_AUTH === "true";

  // If no signature and not allowed no-auth, return helpful debug
  if (!pubkey || !signature) {
    if (!ALLOW_NO_AUTH) {
      return makeResponse({
        error: "Missing signature headers",
        hint: "Set ALLOW_NO_AUTH=true for dev no-auth writes or send x-solana-pubkey and x-solana-signature headers.",
        received: { hasPubkey: !!pubkey, hasSignature: !!signature, signedMessageSample: (signedMessage || "").slice(0, 200) }
      }, 401);
    }
  }

  // Verify signature if provided
  if (pubkey && signature) {
    try {
      const msgBytes = new TextEncoder().encode(signedMessage || "");
      let sigBytes: Uint8Array;
      let pubBytes: Uint8Array;
      try {
        sigBytes = bs58.decode(signature);
      } catch (e) {
        return makeResponse({ error: "signature not valid base58", detail: String(e) }, 400);
      }
      try {
        pubBytes = bs58.decode(pubkey);
      } catch (e) {
        return makeResponse({ error: "pubkey not valid base58", detail: String(e) }, 400);
      }

      // debug log
      console.debug("sigLen:", sigBytes.length, "msgLen:", msgBytes.length, "pubLen:", pubBytes.length);

      const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
      if (!ok) {
        return makeResponse({
          error: "Invalid signature",
          debug: { pubkey, signatureSample: signature.slice(0, 12) + "...", signedMessageSample: (signedMessage || "").slice(0, 200) }
        }, 401);
      }
    } catch (err) {
      console.error("signature verify error", err);
      return makeResponse({ error: "Signature verification error", detail: String(err) }, 400);
    }
  }

  // Proceed to DB ops
  try {
    await connectMongo();
  } catch (err) {
    console.error("Mongo connect error", err);
    return makeResponse({ error: "Database connection error", detail: String(err) }, 500);
  }

  try {
    // identify user by walletAddress (pubkey) or id in payload
    const walletAddress = payloadObj.walletAddress ?? payloadObj.wallet ?? (pubkey ?? null);
    const id = payloadObj.id ?? null;

    let user = null;
    if (id) user = await User.findById(id);
    else if (walletAddress) user = await User.findOne({ walletAddress });

    if (!user) user = new User({ walletAddress: walletAddress ?? undefined });

    // apply updatable fields
    const updatable = ["name", "username", "bio", "email", "location", "website", "displayEmail"];
    for (const key of updatable) {
      if (payloadObj[key] !== undefined) user[key] = payloadObj[key];
    }

    // socials
    user.socials = parseSocials(payloadObj.socials, user.socials);

    await user.save();

    return makeResponse({ ok: true, data: user, via: pubkey ? "signature" : (ALLOW_NO_AUTH ? "no-auth" : "none") }, 200);
  } catch (err) {
    console.error("User save error", err);
      return makeResponse({ error: "Internal server error", detail: String(err) }, 500);
  }
}