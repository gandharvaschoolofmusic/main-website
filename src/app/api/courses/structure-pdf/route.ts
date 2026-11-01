import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/courses/structure-pdf?slug=<course-slug>
 * or /api/courses/structure-pdf?courseId=<course-id>
 *
 * Downloads or previews the Course Structure PDF securely through the internal platform API.
 * This conceals external storage URLs (e.g. Supabase project details) and sends Content-Disposition: attachment
 * so the browser directly downloads the file automatically.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim();
    const courseId = (searchParams.get("courseId") || searchParams.get("id"))?.trim();
    const isInline =
      searchParams.get("view") === "preview" ||
      searchParams.get("inline") === "1" ||
      searchParams.get("inline") === "true";

    if (!slug && !courseId) {
      return NextResponse.json(
        { error: "Missing required parameter 'slug' or 'courseId'" },
        { status: 400 }
      );
    }

    const course = await db.course.findFirst({
      where: slug ? { slug } : { id: courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        structurePdfUrl: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (!course.structurePdfUrl) {
      return NextResponse.json(
        { error: "No course structure PDF has been uploaded for this course" },
        { status: 404 }
      );
    }

    let fileBuffer: Buffer;
    const pdfUrl = course.structurePdfUrl.trim();

    if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) {
      const upstreamRes = await fetch(pdfUrl, {
        headers: {
          "User-Agent": "Gandharva-Platform/1.0",
        },
      });

      if (!upstreamRes.ok) {
        return NextResponse.json(
          { error: "Failed to retrieve PDF file from cloud storage" },
          { status: 502 }
        );
      }

      const arrayBuffer = await upstreamRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else if (pdfUrl.startsWith("/")) {
      // Local file in public/ directory
      const cleanPath = path.normalize(pdfUrl).replace(/^(\.\.[\/\\])+/, "");
      const fullPath = path.join(process.cwd(), "public", cleanPath);

      if (!fs.existsSync(fullPath)) {
        return NextResponse.json(
          { error: "Course structure PDF file not found on server disk" },
          { status: 404 }
        );
      }

      fileBuffer = await fs.promises.readFile(fullPath);
    } else {
      return NextResponse.json(
        { error: "Invalid course structure PDF storage URL" },
        { status: 400 }
      );
    }

    // Format safe and clean attachment filename
    const safeTitle = (course.title || "Course")
      .trim()
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const downloadFilename = `${safeTitle || "Course"}_Structure.pdf`;

    const dispositionType = isInline ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${downloadFilename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    console.error("Error serving course structure PDF:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while retrieving course PDF" },
      { status: 500 }
    );
  }
}

