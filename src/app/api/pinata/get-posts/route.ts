import { NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
const PUBLIC_PINATA_GATEWAY = "https://gateway.pinata.cloud";

// normalize gateway envs: ensure they include protocol
function normalizeGateway(g?: string, defaultUrl = "https://gateway.pinata.cloud") {
  if (!g) return defaultUrl;
  const s = String(g).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}
const PINATA_GATEWAY = normalizeGateway(process.env.PINATA_GATEWAY, "https://gateway.pinata.cloud");
const FALLBACK_GATEWAY = normalizeGateway(process.env.FALLBACK_IPFS_GATEWAY, "https://ipfs.io");

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
    console.error("fetchPinListPage: pinList request failed", { status: res.status, text: String(text).slice(0, 1000) });
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

    // safe fetch helper
    const safeFetch = async (u: string) => {
      try {
        return await fetch(u);
      } catch (e) {
        console.error("safeFetch threw", e, { url: u });
        return null;
      }
    };

    const tryParseResponse = async (r: Response | null) => {
      if (!r) return null;
      const ct = String(r.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json") || ct.includes("text/json")) {
        try {
          return await r.json();
        } catch (e) {
          const body = await r.text().catch(() => "");
          console.error("fetchJsonWithFallback: json parse failed despite content-type", e, { contentType: ct, bodySnippet: String(body).slice(0, 1000) });
          return null;
        }
      }
      const text = await r.text().catch(() => null);
      if (!text) return null;
      const t = text.trim();
      if (t.startsWith("<")) return null; // HTML error page
      try {
        return JSON.parse(t);
      } catch {
        return null;
      }
    };

    // primary
    let res = await safeFetch(attempt);
    const primaryBodySnippet = res ? (await res.clone().text().catch(() => "")).slice(0, 1000) : "";
    if (res && res.ok) {
      const parsed = await tryParseResponse(res);
      if (parsed) return parsed;
    } else if (res) {
      console.warn("fetchJsonWithFallback: primary returned non-ok", {
        url: attempt,
        status: res.status,
        contentType: res.headers.get("content-type"),
        bodySnippet: primaryBodySnippet,
      });
    }

    // ordered fallbacks
    const fallbackCandidates: string[] = [];

    // public pinata gateway (help when custom gateway blocks)
    if (!attempt.includes(PUBLIC_PINATA_GATEWAY)) fallbackCandidates.push(attempt.replace(/^https?:\/\/[^\/]+/, PUBLIC_PINATA_GATEWAY));

    // configured fallback origin (ipfs.io or user-provided)
    try {
      const attemptUrl = new URL(attempt);
      const fallbackOrigin = new URL(FALLBACK_GATEWAY).origin;
      fallbackCandidates.push(`${fallbackOrigin}${attemptUrl.pathname}${attemptUrl.search}`);
    } catch {
      // not a full URL, ignore
    }

    for (const cand of fallbackCandidates) {
      try {
        console.log("fetchJsonWithFallback: trying fallback", cand);
        const r = await safeFetch(cand);
        const parsed = await tryParseResponse(r);
        if (parsed) return parsed;
        if (r && !r.ok) {
          const body = await r.text().catch(() => "");
          console.warn("fetchJsonWithFallback: fallback returned non-ok", { cand, status: r.status, contentType: r.headers.get("content-type"), snippet: String(body).slice(0, 500) });
        }
      } catch (e) {
        console.warn("fetchJsonWithFallback: fallback attempt failed", e, { cand });
      }
    }

    // final: try fallback gateway by extracting CID (ipfs.io or configured FALLBACK_GATEWAY)
    try {
      let cidMatch = attempt.match(/\/ipfs\/([A-Za-z0-9]+)/)?.[1];
      if (!cidMatch) {
        const raw = attempt.replace(/^https?:\/\//, "").replace(/^\/+/, "");
        const m = raw.match(/([A-Za-z0-9]{46,}|Qm[1-9A-HJ-NP-Za-km-z]{44,})/);
        cidMatch = m?.[1];
      }
      if (cidMatch) {
        const ipfsIo = `${FALLBACK_GATEWAY.replace(/\/$/, "")}/ipfs/${cidMatch}`;
        console.log("fetchJsonWithFallback: trying ipfs fallback", ipfsIo);
        const r2 = await safeFetch(ipfsIo);
        const parsed = await tryParseResponse(r2);
        if (parsed) return parsed;
        if (r2 && !r2.ok) {
          const body2 = await r2.text().catch(() => "");
          console.warn("fetchJsonWithFallback: ipfs fallback returned non-ok", { ipfsIo, ok: !!r2?.ok, snippet: String(body2).slice(0, 500) });
        }
      } else {
        console.warn("fetchJsonWithFallback: couldn't extract CID for ipfs fallback", { attempt });
      }
    } catch (e) {
      console.error("fetchJsonWithFallback: ipfs fallback failed", e);
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
  return nameHint === "" ? true : s.includes(nameHint) || s.endsWith("metadata.json") || s.includes("meta");
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
        let metadataUrl = buildGatewayUrlFromCid(cid);
        try {
          if (metadataUrl) {
            // force metadata JSON fetch to use public Pinata gateway to avoid custom gateway blocking
            const u = new URL(metadataUrl.startsWith("http") ? metadataUrl : `https://${metadataUrl}`);
            const pub = new URL(PUBLIC_PINATA_GATEWAY);
            u.protocol = pub.protocol;
            u.host = pub.host;
            metadataUrl = u.toString();
            console.log("GET: metadataUrl (forced public gateway)", metadataUrl);
          } else {
            console.log("GET: metadataUrl (undefined)", metadataUrl);
          }
        } catch (e) {
          console.warn("GET: failed to normalize metadataUrl, using original", { metadataUrl, err: String(e) });
        }
        let meta = await fetchJsonWithFallback(metadataUrl);

        if (!meta) {
          const name = row?.metadata?.name ?? row?.pin?.metadata?.name ?? "";
          console.log("GET: metadata fetch failed, trying name-based fallback", { name });

          const token = String(name).trim();
          // try only if token is a CID (crude match for Qm... or long CID)
          const cidMatch = token.match(/([A-Za-z0-9]{46,}|Qm[1-9A-HJ-NP-Za-km-z]{44,})/)?.[1];

          if (cidMatch) {
            // force public pinata gateway for metadata CIDs (avoids custom gateway blocking)
            const alt = `${PUBLIC_PINATA_GATEWAY.replace(/\/$/, "")}/ipfs/${cidMatch}`;
            console.log("GET: trying alt metadata url (CID via public gateway)", alt);
            meta = await fetchJsonWithFallback(alt);
          } else {
            // skip trying plain names to avoid constructing apricot-.../ipfs/<name>
            console.log("GET: metadata.name is not a CID — skipping name-based fallback to avoid wrong gateway", { name: token });
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
    return NextResponse.json({ error: "failed", detail: String(err) }, { status: 500 });
  }
}