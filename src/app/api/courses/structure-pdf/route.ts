import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadToSupabase, isStorageConfigured } from "@/lib/supabase-storage";
import { logger } from "@/lib/logger";
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

/**
 * POST /api/courses/structure-pdf
 *
 * Accepts multipart/form-data upload of a course structure PDF up to 25MB.
 * Stores in Supabase 'resources' bucket (or local filesystem fallback if unconfigured),
 * returning { success: true, data: { url: string, fileName: string } }.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Please select a PDF file to upload." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF (.pdf) files are allowed for course structure." },
        { status: 400 }
      );
    }

    // 25MB max
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF size cannot exceed 25MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let fileUrl: string | null = null;
    let cloudUploadError: string | null = null;

    // 3. Try Supabase Storage
    try {
      if (isStorageConfigured()) {
        const result = await uploadToSupabase(buffer, file.name, "application/pdf", {
          bucket: "resources",
        });
        if (result?.fileUrl) {
          fileUrl = result.fileUrl;
        }
      }
    } catch (storageErr) {
      cloudUploadError = storageErr instanceof Error ? storageErr.message : String(storageErr);
      logger.warn({ storageErr }, "Supabase storage upload failed in POST route, attempting disk fallback");
    }

    // 4. Fallback to public uploads directory if cloud upload was not successful
    if (!fileUrl) {
      try {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const finalName = `${Date.now()}_${sanitized}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "courses");

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await fs.promises.writeFile(path.join(uploadDir, finalName), buffer);
        fileUrl = `/uploads/courses/${finalName}`;
      } catch (fsErr) {
        logger.error({ fsErr, cloudUploadError }, "Local disk storage fallback also failed");
        return NextResponse.json(
          {
            error:
              cloudUploadError ||
              "Failed to upload file to storage backend and local disk fallback failed.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        fileName: file.name,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error handling course structure PDF upload in POST route");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while processing the PDF upload.",
      },
      { status: 500 }
    );
  }
}

