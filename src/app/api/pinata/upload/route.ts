import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";

if (!PINATA_JWT) console.warn("PINATA_JWT not set - /api/pinata/upload will fail without it");

const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT ?? "",
  pinataGateway: PINATA_GATEWAY,
});

function sanitizeName(s?: string) {
  return String(s ?? "post").replace(/[^a-zA-Z0-9-_\. ]/g, "").replace(/\s+/g, "_").slice(0, 64);
}

async function tryUnpin(hash: string) {
  try {
    if ((pinata as any).upload?.delete) return await (pinata as any).upload.delete(hash);
    if ((pinata as any).pin?.remove) return await (pinata as any).pin.remove(hash);
    if ((pinata as any).unpin) return await (pinata as any).unpin(hash);
    await fetch(`https://api.pinata.cloud/pinning/unpin/${hash}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
    });
  } catch (e) {
    console.warn("tryUnpin failed:", e);
  }
}

export async function POST(request: Request) {
  try {
    // Accept either form-data (with optional file) or JSON body (metadata-only).
    let mediaFile: File | null = null;
    let mediaTypeParam: string | null = null;
    let metadata: any = null;
    let postTextField: string | null = null;

    const contentType = (request.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("application/json")) {
      // JSON body path (metadata-only or with media info references)
      const body = await request.json().catch(() => null);
      console.log("upload: received json body");
      if (!body) return NextResponse.json({ error: "empty json body" }, { status: 400 });
      metadata = body.metadata ?? body;
      mediaTypeParam = body.mediaType ?? body.media_type ?? null;
      postTextField = body.postText ?? body.post_text ?? null;
      // no mediaFile in JSON mode
      mediaFile = null;
    } else {
      // form-data path (supports file upload + metadata)
      const formData = await request.formData();
      mediaFile = (formData.get("mediaFile") || formData.get("file") || null) as File | null;
      mediaTypeParam = (formData.get("mediaType") as string | null) || null;
      const metadataString = formData.get("metadata") as string | null;
      postTextField = (formData.get("postText") as string | null) || null;

      if (metadataString) {
        try {
          metadata = JSON.parse(metadataString);
        } catch (err) {
          return NextResponse.json({ error: "invalid metadata json" }, { status: 400 });
        }
      }
      console.log("upload: received form-data", { hasFile: !!mediaFile, hasMetadata: !!metadata });
    }

    if (!metadata) {
      return NextResponse.json({ error: "metadata is required" }, { status: 400 });
    }

    const postText = String(postTextField ?? metadata.postText ?? metadata.text ?? metadata.post_text ?? "").trim();
    const mime = (mediaFile?.type ?? "").toLowerCase();
    const detectedMediaType =
      mediaTypeParam ||
      (mime.startsWith("image")
        ? "image"
        : mime.startsWith("video")
        ? "video"
        : mime.startsWith("audio")
        ? "audio"
        : mime
        ? mime.split("/")[0]
        : "unknown");
    const prefix = `${sanitizeName(String(metadata.authorPubkey ?? metadata.author ?? "anon").slice(-8))}_${sanitizeName(metadata.title ?? "post")}`;

    // If there's a media file -> upload media first, then metadata
    if (mediaFile) {
      let mediaUpload: any;
      try {
        mediaUpload = await pinata.upload.file(mediaFile, {
          metadata: {
            name: `${prefix}_media_${mediaFile.name}`,
            keyValues: {
              author: metadata.author,
              authorPubkey: metadata.authorPubkey,
              originalFilename: mediaFile.name,
              mediaType: detectedMediaType,
            },
          },
        });
      } catch (uErr) {
        console.error("Media upload failed:", uErr);
        return NextResponse.json({ error: "media upload failed", details: String(uErr) }, { status: 500 });
      }

      const mediaHash = mediaUpload?.IpfsHash || mediaUpload?.Hash || mediaUpload?.hash;
      if (!mediaHash) return NextResponse.json({ error: "media upload returned no ipfs hash", details: mediaUpload }, { status: 500 });
      const mediaUrl = `${PINATA_GATEWAY}/ipfs/${mediaHash}`;

      // attach media reference into metadata
      const metadataForUpload = {
        ...metadata,
        post_text: postText || metadata.post_text || metadata.postText,
        media: {
          ipfs: mediaUrl,
          hash: mediaHash,
          filename: mediaFile.name,
          mime: mediaFile.type || null,
        },
        created_at: metadata.created_at ?? Math.floor(Date.now() / 1000),
      };

      // upload metadata JSON
      let metadataUpload: any;
      try {
        metadataUpload = await pinata.upload.json(metadataForUpload, {
          metadata: {
            name: `${prefix}_metadata`,
            keyValues: {
              author: metadata.author,
              authorPubkey: metadata.authorPubkey,
              mediaHash,
            },
          },
        });
      } catch (mErr) {
        console.error("Metadata upload failed:", mErr);
        tryUnpin(mediaHash).catch(() => {});
        return NextResponse.json({ error: "metadata upload failed", details: String(mErr) }, { status: 500 });
      }

      const metadataHash = metadataUpload?.IpfsHash || metadataUpload?.Hash || metadataUpload?.hash;
      if (!metadataHash) {
        tryUnpin(mediaHash).catch(() => {});
        return NextResponse.json({ error: "metadata upload returned no ipfs hash", details: metadataUpload }, { status: 500 });
      }

      const metadataUrl = `${PINATA_GATEWAY}/ipfs/${metadataHash}`;

      return NextResponse.json({
        success: true,
        data: {
          media: { url: mediaUrl, hash: mediaHash },
          metadata: { url: metadataUrl, hash: metadataHash },
        },
      });
    }

    // No media: upload metadata-only (same route)
    const metadataOnlyPayload = {
      ...metadata,
      post_text: postText || metadata.post_text || metadata.postText,
      created_at: metadata.created_at ?? Math.floor(Date.now() / 1000),
    };

    let metadataUploadOnly: any;
    try {
      metadataUploadOnly = await pinata.upload.json(metadataOnlyPayload, {
        metadata: {
          name: `${prefix}_metadata`,
          keyValues: {
            author: metadata.author,
            authorPubkey: metadata.authorPubkey,
          },
        },
      });
    } catch (err) {
      console.error("metadata-only upload failed:", err);
      return NextResponse.json({ error: "metadata upload failed", details: String(err) }, { status: 500 });
    }

    const metadataHashOnly = metadataUploadOnly?.IpfsHash || metadataUploadOnly?.Hash || metadataUploadOnly?.hash;
    if (!metadataHashOnly) return NextResponse.json({ error: "metadata upload returned no ipfs hash", details: metadataUploadOnly }, { status: 500 });

    const metadataUrlOnly = `${PINATA_GATEWAY}/ipfs/${metadataHashOnly}`;

    return NextResponse.json({
      success: true,
      data: {
        media: null,
        metadata: { url: metadataUrlOnly, hash: metadataHashOnly },
      },
    });
  } catch (err) {
    console.error("upload route unexpected error:", err);
    return NextResponse.json({ error: "unexpected", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}