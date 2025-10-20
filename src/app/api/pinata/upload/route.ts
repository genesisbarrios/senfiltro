import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

async function callModerationRoute(ipfsHash: string, type = "image") {
  try {
    const res = await fetch(process.env.MODERATE_URL ?? "http://localhost:3000/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipfsHash, type }),
    });
    if (!res.ok) {
      console.warn("Moderation route returned non-OK:", res.status);
      return { ok: false, sensitive: false, details: `moderation(${res.status})` };
    }
    const json = await res.json();
    return { ok: true, sensitive: Boolean(json?.sensitive), details: json };
  } catch (err) {
    console.error("Moderation call failed:", err);
    return { ok: false, sensitive: false, details: err instanceof Error ? err.message : String(err) };
  }
}

async function tryUnpin(hash: string) {
  try {
    if ((pinata as any).upload?.delete) {
      await (pinata as any).upload.delete(hash);
      return;
    }
  } catch (e) {
    console.warn("pinata.upload.delete failed:", e);
  }
  try {
    if ((pinata as any).pin?.remove) {
      await (pinata as any).pin.remove(hash);
      return;
    }
  } catch (e) {
    console.warn("pinata.pin.remove failed:", e);
  }
  try {
    if ((pinata as any).unpin) {
      await (pinata as any).unpin(hash);
      return;
    }
  } catch (e) {
    console.warn("pinata.unpin failed:", e);
  }
  console.warn("No known unpin method succeeded for hash:", hash);
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting media+post upload...");

    const formData = await request.formData();

    // support different field names depending on client: mediaFile, imageFile, audioFile, etc.
    const mediaFile = (formData.get("mediaFile") || formData.get("imageFile") || formData.get("audioFile") || null) as File | null;
    const mediaTypeParam = (formData.get("mediaType") as string | null) || null; // "image"|"video"|"audio"
    const metadataString = formData.get("metadata") as string | null;
    const postTextField = (formData.get("postText") as string | null) || null;

    if (!mediaFile) {
      return NextResponse.json({ error: "mediaFile is required" }, { status: 400 });
    }
    if (!metadataString) {
      return NextResponse.json({ error: "metadata is required" }, { status: 400 });
    }

    let metadata: any;
    try {
      metadata = JSON.parse(metadataString);
    } catch (err) {
      return NextResponse.json({ error: "invalid metadata json" }, { status: 400 });
    }

    // Basic metadata validation
    if (!metadata.author || !metadata.authorPubkey) {
      return NextResponse.json({ error: "metadata must include author and authorPubkey" }, { status: 400 });
    }

    // get postText from explicit field or from metadata
    const postText = String(postTextField ?? metadata.postText ?? metadata.text ?? "").trim();

    // sanitize and build filenames
    const sanitize = (s: string) => (s || "").replace(/[^a-zA-Z0-9-_\. ]/g, "").replace(/\s+/g, "_").slice(0, 64);
    const fileExt = (mediaFile.name?.split(".").pop() || "bin").toLowerCase();
    const prefix = `${sanitize(String(metadata.authorPubkey).slice(-8))}_${sanitize(metadata.title || "post")}`;
    const mediaName = `${prefix}_media.${fileExt}`;

    // Optional: create a Pinata group if desired (safe ignore if fails)
    let groupId: string | undefined;
    try {
      if ((pinata as any).groups?.create) {
        const g = await (pinata as any).groups.create({ name: `${prefix}_group` });
        groupId = g?.id;
      }
    } catch (gErr) {
      console.warn("Failed to create pinata group (continuing):", gErr);
    }

    // Upload media
    let mediaUpload: any;
    try {
      mediaUpload = await pinata.upload.file(mediaFile, {
        metadata: {
          name: mediaName,
          keyValues: {
            author: metadata.author,
            authorPubkey: metadata.authorPubkey,
            originalFilename: mediaFile.name,
            mediaType: mediaTypeParam || mediaFile.type || "unknown",
            postTextSnippet: postText ? postText.slice(0, 140) : "",
          },
        },
        groupId,
      });
    } catch (uErr) {
      console.error("Media upload failed:", uErr);
      return NextResponse.json({ error: "media upload failed", details: uErr instanceof Error ? uErr.message : String(uErr) }, { status: 500 });
    }

    const mediaHash = mediaUpload?.IpfsHash || mediaUpload?.Hash || mediaUpload?.hash;
    if (!mediaHash) {
      console.error("Pinata returned no hash for media:", mediaUpload);
      return NextResponse.json({ error: "media upload returned no ipfs hash" }, { status: 500 });
    }
    const mediaUrl = `${process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud"}/ipfs/${mediaHash}`;

    // If image (either declared or detected), run moderation
    const maybeType = (mediaTypeParam || mediaFile.type || "").toLowerCase();
    const isImage = maybeType.startsWith("image") || maybeType.includes("image") || (mediaTypeParam === "image");

    if (isImage) {
      const mod = await callModerationRoute(mediaHash, "image");
      if (!mod.ok) {
        console.warn("Moderation route returned non-ok:", mod.details);
      }
      if (mod.sensitive) {
        try {
          await tryUnpin(mediaHash);
        } catch (e) {
          console.error("Failed to unpin sensitive media:", e);
        }
        return NextResponse.json({ error: "media failed moderation and was removed", details: mod.details }, { status: 400 });
      }
    }

    // Build metadata object to store on IPFS (this becomes metadata_cid content)
    const postMetadata = {
      // match your Post struct expectations + keep original metadata fields
      author: metadata.author,
      authorPubkey: metadata.authorPubkey,
      post_text: postText,
      media: {
        ipfs: mediaUrl,
        hash: mediaHash,
        filename: mediaFile.name,
        mime: mediaFile.type || null,
      },
      ai_generated: Boolean(metadata.ai_generated),
      likes: 0,
      dislikes: 0,
      created_at: Math.floor(Date.now() / 1000), // unix seconds
      deleted: false,
      extra: metadata.extra || {},
    };

    // Upload metadata JSON to Pinata
    let metadataUpload: any;
    try {
      metadataUpload = await pinata.upload.json(postMetadata, {
        metadata: {
          name: `${prefix}_metadata`,
          keyValues: {
            author: metadata.author,
            authorPubkey: metadata.authorPubkey,
            mediaHash,
            mediaType: mediaTypeParam || mediaFile.type,
            postTextSnippet: postText ? postText.slice(0, 140) : "",
          },
        },
        groupId,
      });
    } catch (mErr) {
      console.error("Metadata upload failed:", mErr);
      // Attempt cleanup of media if metadata upload fails
      try {
        await tryUnpin(mediaHash);
      } catch (e) {
        console.warn("Failed to cleanup media after metadata upload failure:", e);
      }
      return NextResponse.json({ error: "metadata upload failed", details: mErr instanceof Error ? mErr.message : String(mErr) }, { status: 500 });
    }

    const metadataHash = metadataUpload?.IpfsHash || metadataUpload?.Hash || metadataUpload?.hash;
    if (!metadataHash) {
      console.error("Pinata returned no hash for metadata:", metadataUpload);
      return NextResponse.json({ error: "metadata upload returned no ipfs hash" }, { status: 500 });
    }
    const metadataUrl = `${process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud"}/ipfs/${metadataHash}`;

    // Return metadata url (this should be stored on-chain as Post.metadata_cid)
    return NextResponse.json({
      success: true,
      message: "Upload + moderation completed",
      data: {
        media: { url: mediaUrl, hash: mediaHash },
        metadata: { url: metadataUrl, hash: metadataHash },
        post_text: postText,
      },
    });
  } catch (err) {
    console.error("Unexpected error in upload route:", err);
    return NextResponse.json({ error: "unexpected error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}