import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FontKind = {
  mime: string;
  ext: string;
};

function inferFontKind(url: string, contentType?: string | null): FontKind {
  const source = `${url} ${contentType || ""}`.toLowerCase();
  if (source.includes("woff2")) return { mime: "font/woff2", ext: "woff2" };
  if (source.includes("woff")) return { mime: "font/woff", ext: "woff" };
  if (source.includes("ttf") || source.includes("truetype")) return { mime: "font/ttf", ext: "ttf" };
  return { mime: "font/otf", ext: "otf" };
}

function isAllowedFontHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "firebasestorage.googleapis.com" ||
    host.endsWith(".firebasestorage.app") ||
    host.endsWith(".appspot.com") ||
    host === "storage.googleapis.com" ||
    host.endsWith(".googleapis.com")
  );
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url") || "";
  const name = request.nextUrl.searchParams.get("name") || "font";

  if (!source) {
    return NextResponse.json({ error: "Missing font url." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid font url." }, { status: 400 });
  }

  if (url.protocol !== "https:" || !isAllowedFontHost(url.hostname)) {
    return NextResponse.json({ error: "Font host is not allowed." }, { status: 403 });
  }

  const upstream = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "Accept": "font/otf,font/ttf,font/woff2,font/woff,application/octet-stream,*/*"
    }
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Could not fetch font.", status: upstream.status }, { status: upstream.status });
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength && contentLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Font file is too large." }, { status: 413 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Font file is too large." }, { status: 413 });
  }

  const kind = inferFontKind(source, upstream.headers.get("content-type"));
  const safeName = name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || `font.${kind.ext}`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": kind.mime,
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="${safeName}"`
    }
  });
}
