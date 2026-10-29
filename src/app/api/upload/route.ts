import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToSupabase, isStorageConfigured } from "@/lib/supabase-storage";
import { isAllowedFileType, MAX_FILE_SIZE_BYTES } from "@/lib/pii-filter";
import { logger } from "@/lib/logger";

/**
 * POST /api/upload
 * Accepts multipart form data with a single file.
 * Uploads to Supabase storage/database and returns the file URL.
 *
 * Auth: requires an authenticated session.
 * Restrictions: PDF/DOC/DOCX only, 10MB max.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "You must be signed in to upload files." },
        { status: 401 },
      );
    }

    // 2. Check Storage is configured
    if (!isStorageConfigured()) {
      return Response.json(
        {
          error:
            "File upload is not available. Storage backend is not configured.",
        },
        { status: 503 },
      );
    }

    // 3. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    // 4. Validate file type
    if (!isAllowedFileType(file.name)) {
      return Response.json(
        { error: "Only PDF and DOC/DOCX files are allowed." },
        { status: 400 },
      );
    }

    // 5. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: "File size cannot exceed 10MB." },
        { status: 400 },
      );
    }

    // 6. Convert to buffer and upload to Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadToSupabase(buffer, file.name, file.type, {
      bucket: "chat-attachments",
    });

    logger.info(
      { userId: session.user.id, fileName: file.name, fileId: result.fileId, backend: result.storageBackend },
      "File uploaded via messaging to Supabase",
    );

    return Response.json({
      success: true,
      fileId: result.fileId,
      fileName: result.fileName,
      fileUrl: result.fileUrl,
      fileSizeBytes: result.fileSizeBytes,
      mimeType: result.mimeType,
      storageBackend: result.storageBackend,
    });
  } catch (error) {
    logger.error({ error }, "File upload failed");

    const message =
      error instanceof Error ? error.message : "File upload failed.";

    return Response.json({ error: message }, { status: 500 });
  }
}
