import { NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
const FALLBACK_GATEWAY = process.env.FALLBACK_IPFS_GATEWAY || "https://ipfs.io";

if (!PINATA_JWT) {
  console.warn("PINATA_JWT not set - /api/pinata/get-posts will fail without it");
}

type PinRow = any;

async function fetchPinListPage(pageLimit = 50, pageOffset = 0): Promise<PinRow[]> {
  const url = `https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=${pageLimit}&pageOffset=${pageOffset}`;
  console.log("fetchPinListPage: requesting", { url, pageLimit, pageOffset });
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${PINATA_JWT ?? ""}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("fetchPinListPage: pinList request failed", { status: res.status, text });
    throw new Error(`pinList failed ${res.status} ${text}`);
  }
  const json = await res.json().catch((e) => {
    console.error("fetchPinListPage: invalid json", e);
    return null;
  });
  console.log("fetchPinListPage: received", { rowsLength: json?.rows?.length ?? 0 });
  return json?.rows ?? [];
}

function buildGatewayUrlFromCid(cidOrPath?: string) {
  if (!cidOrPath) return undefined;
  const raw = String(cidOrPath).trim();
  if (!raw) return undefined;

  // Already absolute URL
  if (/^https?:\/\//i.test(raw)) return raw;

  // Host/path like "apricot-...mypinata.cloud/ipfs/CID" -> ensure https:// prefix
  if (/^[^\/]+\.[^\/]+/.test(raw) && !raw.startsWith("ipfs://")) {
    return raw.startsWith("https://") || raw.startsWith("http://") ? raw : `https://${raw}`;
  }

  // ipfs://CID/path -> map to gateway
  if (raw.startsWith("ipfs://")) {
    return `${PINATA_GATEWAY}/ipfs/${raw.replace(/^ipfs:\/\//, "")}`;
  }

  // /ipfs/<cid>/... or plain cid/path
  const m = raw.match(/(?:\/?ipfs\/)?(.+)/);
  if (m && m[1]) {
    return `${PINATA_GATEWAY}/ipfs/${m[1]}`;
  }

  // fallback
  return `${PINATA_GATEWAY}/ipfs/${raw}`;
}


async function fetchJsonWithFallback(url?: string) {
  if (!url) return null;
  try {
    let attempt = String(url).trim();
    try {
      // validate URL
      // eslint-disable-next-line no-new
      new URL(attempt);
    } catch {
      attempt = attempt.startsWith("https://") || attempt.startsWith("http://") ? attempt : `https://${attempt}`;
    }

    console.log("fetchJsonWithFallback: fetching", attempt);
    let res = await fetch(attempt).catch((e) => {
      console.error("fetchJsonWithFallback: fetch threw", e, { attempt });
      return null as unknown as Response;
    });
    if (!res) return null;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("fetchJsonWithFallback: primary gateway returned non-ok", {
        url: attempt,
        status: res.status,
        contentType: res.headers.get("content-type"),
        bodySnippet: String(errText).slice(0, 1000),
      });
      try {
        const attemptUrl = new URL(attempt);
        const fallbackOrigin = new URL(FALLBACK_GATEWAY).origin;
        const altUrl = `${fallbackOrigin}${attemptUrl.pathname}${attemptUrl.search}`;
        console.log("fetchJsonWithFallback: trying fallback gateway", altUrl);
        res = await fetch(altUrl).catch((e) => {
          console.error("fetchJsonWithFallback: fallback fetch threw", e, { altUrl });
          return null as unknown as Response;
        });
      } catch (e) {
        console.warn("fetchJsonWithFallback: building fallback url failed", e);
      }
    }

    if (!res) return null;
    if (!res.ok) {
      const errText2 = await res.text().catch(() => "");
      console.warn("fetchJsonWithFallback: both gateways failed", {
        url: attempt,
        status: res.status,
        contentType: res.headers.get("content-type"),
        bodySnippet: String(errText2).slice(0, 1000),
      });
      // fall through to try ipfs.io below
    }

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json") || contentType.includes("text/json")) {
      try {
        const json = await res.json();
        console.log("fetchJsonWithFallback: success (json)", { url: attempt });
        return json;
      } catch (e) {
        const body = await res.text().catch(() => "");
        console.error("fetchJsonWithFallback: json parse failed despite content-type", e, {
          url: attempt,
          contentType,
          bodySnippet: String(body).slice(0, 1000),
        });
        // fall through to try ipfs.io
      }
    }

    const text = await res.text().catch(() => null);
    if (!text) {
      console.warn("fetchJsonWithFallback: empty body, will try ipfs.io fallback", { url: attempt });
    } else {
      const trimmed = text.trim();
      if (trimmed.startsWith("<")) {
        console.warn("fetchJsonWithFallback: response appears to be HTML, will try ipfs.io fallback", {
          url: attempt,
          snippet: trimmed.slice(0, 200),
        });
      } else {
        // If it's not HTML but also not JSON, attempt parse once
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          console.warn("fetchJsonWithFallback: non-JSON body, will try ipfs.io fallback", { url: attempt });
        }
      }
    }

    // Final attempt: if attempt contains a CID or /ipfs/<cid>, try ipfs.io directly
    let cidMatch = attempt.match(/\/ipfs\/([A-Za-z0-9]+)/)?.[1];
    if (!cidMatch) {
      // maybe attempt was just the cid or plain raw
      const raw = attempt.replace(/^https?:\/\//, "").replace(/^\/+/, "");
      const m = raw.match(/([A-Za-z0-9]{46,}|Qm[1-9A-HJ-NP-Za-km-z]{44,})/); // crude CID match
      cidMatch = m?.[1];
    }
    if (cidMatch) {
      const ipfsIo = `https://ipfs.io/ipfs/${cidMatch}`;
      console.log("fetchJsonWithFallback: trying ipfs.io fallback", ipfsIo);
      try {
        const r2 = await fetch(ipfsIo).catch((e) => {
          console.error("fetchJsonWithFallback: ipfs.io fetch threw", e, { ipfsIo });
          return null as unknown as Response;
        });
        if (r2 && r2.ok) {
          const ct2 = String(r2.headers.get("content-type") || "").toLowerCase();
          if (ct2.includes("application/json") || ct2.includes("text/json")) {
            try {
              const j = await r2.json();
              console.log("fetchJsonWithFallback: success via ipfs.io", { ipfsIo });
              return j;
            } catch (e) {
              console.error("fetchJsonWithFallback: ipfs.io json parse failed", e);
            }
          } else {
            const t2 = await r2.text().catch(() => "");
            if (t2 && !t2.trim().startsWith("<")) {
              try {
                return JSON.parse(t2);
              } catch (e) {
                /* ignore */
              }
            }
          }
        } else {
          console.warn("fetchJsonWithFallback: ipfs.io returned non-ok", { ipfsIo, ok: !!r2?.ok });
        }
      } catch (e) {
        console.error("fetchJsonWithFallback: ipfs.io attempt failed", e);
      }
    } else {
      console.warn("fetchJsonWithFallback: couldn't extract CID for ipfs.io fallback", { attempt });
    }

    return null;
  } catch (err) {
    console.error("fetchJsonWithFallback: unexpected error", err);
    return null;
  }
}

function looksLikeMetadata(row: PinRow, nameHint = "metadata") {
  const name =
    row?.metadata?.name ??
    row?.pin?.metadata?.name ??
    row?.pinning_attempts?.[0]?.metadata?.name ??
    "";
  const s = String(name || "").toLowerCase();
  return s.includes(nameHint) || s.endsWith("metadata.json") || s.includes("meta");
}

function extractMediaFromMeta(meta: any) {
  if (!meta) return { mediaUrl: undefined, mediaHash: undefined, mediaType: undefined, mediaFilename: undefined };

  let mediaCidOrUrl: string | undefined;
  let mediaMime: string | undefined;
  let mediaFilename: string | undefined;

  if (meta.media) {
    if (typeof meta.media === "string") {
      mediaCidOrUrl = meta.media;
    } else {
      mediaCidOrUrl = meta.media.url ?? meta.media.ipfs ?? meta.media.hash ?? meta.media.cid ?? meta.mediaIpfs ?? undefined;
      mediaMime = meta.media.mime ?? meta.media.type ?? undefined;
      mediaFilename = meta.media.filename ?? meta.media.name ?? undefined;
    }
  }

  if (!mediaCidOrUrl) {
    mediaCidOrUrl = meta.image ?? meta.media_ipfs ?? meta.mediaHash ?? meta.image_cid ?? meta.file ?? undefined;
  }

  if (!mediaCidOrUrl && Array.isArray(meta.files) && meta.files.length) {
    const f = meta.files[0];
    mediaCidOrUrl = f?.cid ?? f?.ipfs ?? f?.url;
    mediaFilename = f?.name ?? f?.filename ?? mediaFilename;
    mediaMime = f?.mime ?? mediaMime;
  }

  const mediaUrl = buildGatewayUrlFromCid(mediaCidOrUrl);
  let mediaType: string | undefined;
  if (mediaMime) mediaType = mediaMime.split("/")[0];
  if (!mediaType && mediaUrl) {
    const ext = mediaUrl.split(".").pop()?.split(/\?|#/)[0]?.toLowerCase() ?? "";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) mediaType = "image";
    else if (["mp4", "webm", "mov", "mkv"].includes(ext)) mediaType = "video";
    else if (["mp3", "wav", "ogg", "m4a"].includes(ext)) mediaType = "audio";
    else mediaType = "unknown";
  }

  return { mediaUrl: mediaUrl ?? undefined, mediaHash: mediaCidOrUrl ?? undefined, mediaType, mediaFilename };
}

export async function GET(req: Request) {
  try {
    if (!PINATA_JWT) return NextResponse.json({ error: "PINATA_JWT not configured" }, { status: 500 });

    const url = new URL(req.url);
    const pageLimit = Number(url.searchParams.get("pageLimit") || "50");
    const maxResults = Number(url.searchParams.get("maxResults") || "200");
    const nameHint = String(url.searchParams.get("nameHint") || "metadata");

    console.log("GET /api/pinata/get-posts start", { pageLimit, maxResults, nameHint });

    let pageOffset = 0;
    const metadataRows: PinRow[] = [];

    // paginate until we have enough or pages exhausted
    while (metadataRows.length < maxResults) {
      console.log("GET: fetching pin list page", { pageOffset, pageLimit });
      const rows = await fetchPinListPage(pageLimit, pageOffset);
      console.log("GET: pin list page received", { pageOffset, rowsLength: rows?.length ?? 0 });
      if (!rows || rows.length === 0) break;
      for (const r of rows) {
        try {
          const name = r?.metadata?.name ?? r?.pin?.metadata?.name ?? "";
          const cidCandidate = r?.ipfs_pin_hash ?? r?.ipfs_hash ?? r?.ipfsPinHash ?? r?.pin?.cid ?? null;
          if (looksLikeMetadata(r, nameHint)) {
            console.log("GET: looksLikeMetadata -> adding row", { name, cidCandidate });
            metadataRows.push(r);
          }
        } catch (e) {
          console.warn("GET: error inspecting row", e);
        }
      }
      if (rows.length < pageLimit) break;
      pageOffset += pageLimit;
    }

    console.log("GET: total metadataRows found", metadataRows.length);

    const results: any[] = [];
    let idx = 0;
    for (const row of metadataRows) {
      idx++;
      try {
        const cid =
          row?.ipfs_pin_hash ??
          row?.ipfs_hash ??
          row?.ipfsPinHash ??
          row?.pin?.cid ??
          row?.pin?.ipfs_pin_hash ??
          row?.pin?.ipfs_hash ??
          null;
        console.log("GET: processing metadata row", { idx, cid });
        // Build a gateway URL for the cid (handles host/path or plain CID)
        const metadataUrl = buildGatewayUrlFromCid(cid);
        console.log("GET: metadataUrl", metadataUrl);
        let meta = await fetchJsonWithFallback(metadataUrl);

        if (!meta) {
          // fallback: maybe metadata name contains a path/CID or custom host
          const name = row?.metadata?.name ?? row?.pin?.metadata?.name ?? "";
          console.log("GET: metadata fetch failed, trying name-based fallback", { name });
          const m = String(name).match(/([A-Za-z0-9][A-Za-z0-9\-_\.\/:]*)/);
          if (m) {
            const alt = buildGatewayUrlFromCid(m[1]);
            console.log("GET: trying alt metadata url", alt);
            meta = await fetchJsonWithFallback(alt);
          }
        }

        if (!meta) {
          console.warn("GET: metadata still not found for row, skipping", { idx, cid });
          continue;
        }

        console.log("GET: metadata fetched", { idx, cid, hasMedia: !!(meta.media || meta.image || meta.files) });
        const media = extractMediaFromMeta(meta);
        // Only include media fields when a media reference exists in metadata.
        // If metadata doesn't reference a media file, set media* fields explicitly to null.
        const item: any = {
          metadataCid: cid,
          metadataUrl,
          metadata: meta,
        };

        if (media && (media.mediaUrl || media.mediaHash)) {
          item.mediaUrl = media.mediaUrl ?? null;
          item.mediaHash = media.mediaHash ?? null;
          item.mediaType = media.mediaType ?? null;
          item.mediaFilename = media.mediaFilename ?? null;
        } else {
          item.mediaUrl = null;
          item.mediaHash = null;
          item.mediaType = null;
          item.mediaFilename = null;
        }

        results.push(item);
       } catch (e) {
         console.warn("metadata processing failed", e);
       }
     }

    console.log("GET: finished processing, results count", results.length);
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (err) {
    console.error("list-posts error:", err);
    return NextResponse.json({ error: "failed", detail: String(err) }, { status: 500
    });
  }
} 