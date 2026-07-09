import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap.

// RT-08: raster allowlist only. SVG is intentionally excluded (script-bearing
// SVG is a stored-XSS vector). MIME is sniffed from magic bytes, not trusted
// from the client-declared Content-Type or file extension.
const SNIFFERS: { ext: string; mime: string; match: (b: Uint8Array) => boolean }[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    match: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "gif",
    mime: "image/gif",
    match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
  {
    ext: "webp",
    mime: "image/webp",
    match: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

function sniff(bytes: Uint8Array): { ext: string; mime: string } | null {
  return SNIFFERS.find((s) => s.match(bytes)) ?? null;
}

export async function POST(req: Request) {
  // RT-01/upload: explicit in-route guard, not just the middleware matcher.
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image upload is not configured (missing Blob token)." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit` },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) {
    return NextResponse.json(
      { error: "Unsupported image type. Allowed: JPEG, PNG, GIF, WebP." },
      { status: 415 },
    );
  }

  const key = `posts/${crypto.randomUUID()}.${kind.ext}`;
  const blob = await put(key, Buffer.from(bytes), {
    access: "public",
    contentType: kind.mime,
  });

  return NextResponse.json({ url: blob.url });
}
