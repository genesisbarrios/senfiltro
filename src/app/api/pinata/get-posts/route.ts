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
  
  if (Array.isArray(json?.rows) && json.rows.length) {
    const sample = json.rows.slice(0, 5).map((r: any) => ({
      name: r?.metadata?.name ?? r?.pin?.metadata?.name ?? null,
      ipfs_pin_hash: r?.ipfs_pin_hash ?? r?.ipfs_hash ?? r?.pin?.cid ?? null,
    }));
    console.log("fetchPinListPage: sample rows", sample);
  }
  
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
  const PUBLIC_PINATA_GATEWAY = "https://gateway.pinata.cloud";
  try {
    let attempt = String(url).trim();
    try {
      // ensure absolute URL
      // eslint-disable-next-line no-new
      new URL(attempt);
    } catch {
      attempt = attempt.startsWith("https://") || attempt.startsWith("http://") ? attempt : `https://${attempt}`;
    }

    console.log("fetchJsonWithFallback: fetching", attempt);

    // helper to safely fetch and return Response or null
    const safeFetch = async (u: string) => {
      try {
        return await fetch(u);
      } catch (e) {
        console.error("safeFetch threw", e, { url: u });
        return null;
      }
    };

    let res = await safeFetch(attempt);
    if (!res) return null;

    // on non-ok try configured fallback origin
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("fetchJsonWithFallback: primary returned non-ok", {
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
        res = await safeFetch(altUrl) ?? res;
      } catch (e) {
        console.warn("fetchJsonWithFallback: building fallback url failed", e);
      }
    }

    if (!res) return null;

    // If content-type claims JSON try parse
    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json") || ct.includes("text/json")) {
      try {
        const j = await res.json();
        console.log("fetchJsonWithFallback: parsed json", { url: attempt });
        return j;
      } catch (e) {
        // fall through to text handling
        const body = await res.text().catch(() => "");
        console.error("fetchJsonWithFallback: json parse failed despite content-type", e, {
          url: attempt,
          contentType: ct,
          bodySnippet: String(body).slice(0, 1000),
        });
      }
    } else {
      // read text once for heuristics
      const text = await res.text().catch(() => null);
      if (!text) {
        console.warn("fetchJsonWithFallback: empty body, will try other fallbacks", { url: attempt });
      } else {
        const trimmed = text.trim();
        if (trimmed.startsWith("<")) {
          console.warn("fetchJsonWithFallback: response looks like HTML, will try other fallbacks", {
            url: attempt,
            snippet: trimmed.slice(0, 200),
          });
        } else {
          // not HTML; attempt parse
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            console.warn("fetchJsonWithFallback: text response not JSON, will try other fallbacks", { url: attempt });
          }
        }
      }
    }

    // Try public pinata gateway as intermediate fallback (helps if custom gateway blocks CID)
    try {
      if (!attempt.includes(PUBLIC_PINATA_GATEWAY)) {
        const publicUrl = attempt.replace(/^https?:\/\/[^\/]+/, PUBLIC_PINATA_GATEWAY);
        console.log("fetchJsonWithFallback: trying public pinata gateway", publicUrl);
        const rpub = await safeFetch(publicUrl);
        if (rpub && rpub.ok) {
          const ctp = String(rpub.headers.get("content-type") || "").toLowerCase();
          if (ctp.includes("application/json") || ctp.includes("text/json")) {
            try {
              const jpub = await rpub.json();
              console.log("fetchJsonWithFallback: success via public pinata gateway", { publicUrl });
              return jpub;
            } catch (e) {
              const bp = await rpub.text().catch(() => "");
              console.warn("fetchJsonWithFallback: public gateway json parse failed", e, { publicUrl, snippet: bp.slice(0, 200) });
            }
          } else {
            const tp = await rpub.text().catch(() => "");
            if (tp && !tp.trim().startsWith("<")) {
              try {
                return JSON.parse(tp);
              } catch {
                /* ignore */
              }
            }
          }
        } else {
          console.warn("fetchJsonWithFallback: public gateway returned non-ok", { publicUrl, ok: !!rpub?.ok });
        }
      }
    } catch (e) {
      console.warn("fetchJsonWithFallback: public gateway attempt failed", e);
    }

    // Final: try ipfs.io if we can extract a CID
    try {
      let cidMatch = attempt.match(/\/ipfs\/([A-Za-z0-9]+)/)?.[1];
      if (!cidMatch) {
        const raw = attempt.replace(/^https?:\/\//, "").replace(/^\/+/, "");
        const m = raw.match(/([A-Za-z0-9]{46,}|Qm[1-9A-HJ-NP-Za-km-z]{44,})/);
        cidMatch = m?.[1];
      }
      if (cidMatch) {
        const ipfsIo = `https://ipfs.io/ipfs/${cidMatch}`;
        console.log("fetchJsonWithFallback: trying ipfs.io fallback", ipfsIo);
        const r2 = await safeFetch(ipfsIo);
        if (r2 && r2.ok) {
          const ct2 = String(r2.headers.get("content-type") || "").toLowerCase();
          if (ct2.includes("application/json") || ct2.includes("text/json")) {
            try {
              const j2 = await r2.json();
              console.log("fetchJsonWithFallback: success via ipfs.io", { ipfsIo });
              return j2;
            } catch (e) {
              const b2 = await r2.text().catch(() => "");
              console.error("fetchJsonWithFallback: ipfs.io json parse failed", e, { ipfsIo, snippet: b2.slice(0, 200) });
            }
          } else {
            const t2 = await r2.text().catch(() => "");
            if (t2 && !t2.trim().startsWith("<")) {
              try {
                return JSON.parse(t2);
              } catch {
                /* ignore */
              }
            }
          }
        } else {
          console.warn("fetchJsonWithFallback: ipfs.io returned non-ok", { ipfsIo, ok: !!r2?.ok });
        }
      } else {
        console.warn("fetchJsonWithFallback: couldn't extract CID for ipfs.io fallback", { attempt });
      }
    } catch (e) {
      console.error("fetchJsonWithFallback: ipfs.io attempt failed", e);
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