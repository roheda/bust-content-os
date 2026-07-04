import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAllowedImageHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "firebasestorage.googleapis.com" ||
    host.endsWith(".firebasestorage.app") ||
    host.endsWith(".appspot.com") ||
    host === "storage.googleapis.com" ||
    host.endsWith(".googleapis.com") ||
    host.endsWith(".googleusercontent.com") ||
    host.endsWith(".vercel.app")
  );
}

function inferImageMime(url: string, contentType?: string | null) {
  const source = `${url} ${contentType || ""}`.toLowerCase();
  if (source.includes("image/webp") || /\.webp(\?|$)/.test(source)) return "image/webp";
  if (source.includes("image/jpeg") || /\.jpe?g(\?|$)/.test(source)) return "image/jpeg";
  if (source.includes("image/png") || /\.png(\?|$)/.test(source)) return "image/png";
  if (source.includes("image/gif") || /\.gif(\?|$)/.test(source)) return "image/gif";
  return "image/png";
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url") || "";

  if (!source) {
    return NextResponse.json({ error: "Missing image url." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image url." }, { status: 400 });
  }

  if (url.protocol !== "https:" || !isAllowedImageHost(url.hostname)) {
    return NextResponse.json({ error: "Image host is not allowed." }, { status: 403 });
  }

  const upstream = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*"
    }
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Could not fetch image.", status: upstream.status }, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Source is not an image." }, { status: 415 });
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength && contentLength > 24 * 1024 * 1024) {
    return NextResponse.json({ error: "Image file is too large." }, { status: 413 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > 24 * 1024 * 1024) {
    return NextResponse.json({ error: "Image file is too large." }, { status: 413 });
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": inferImageMime(source, contentType),
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}
