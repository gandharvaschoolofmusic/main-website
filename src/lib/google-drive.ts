/**
 * Google Drive integration for file uploads in messaging.
 *
 * Uses a Google Cloud Service Account to upload files to a
 * configurable Google Drive folder. The folder ID is stored in
 * PlatformSettings and can be changed by an admin.
 *
 * Setup instructions:
 * 1. Create a Google Cloud project at https://console.cloud.google.com
 * 2. Enable the Google Drive API
 * 3. Create a Service Account, download its JSON key
 * 4. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local
 * 5. Share the target Drive folder with the service account email (Editor access)
 * 6. Set the folder ID in Admin > Platform Settings
 */

import { google } from "googleapis";
import { Readable } from "stream";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Get an authenticated Google Drive client using service account credentials.
 */
function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error(
      "Google Drive credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local",
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, "\n"), // Handle escaped newlines from .env
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// ─── Folder ID ───────────────────────────────────────────────────────────────

/**
 * Extract Google Drive folder ID from a Drive URL or return raw ID.
 * Handles:
 *  - https://drive.google.com/drive/folders/FOLDER_ID
 *  - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 *  - Raw folder ID string
 */
export function extractFolderId(input: string): string | null {
  if (!input?.trim()) return null;

  const trimmed = input.trim();

  // Try to extract from URL
  const urlMatch = trimmed.match(
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  // If it looks like a raw folder ID (alphanumeric with hyphens/underscores)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Get the configured Google Drive folder ID from environment or PlatformSettings.
 */
export async function getConfiguredFolderId(): Promise<string | null> {
  // 1. Check environment variable override
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    const extracted = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
    if (extracted) return extracted;
  }
  if (process.env.GOOGLE_DRIVE_FOLDER_LINK) {
    const extracted = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_LINK);
    if (extracted) return extracted;
  }

  // 2. Check PlatformSettings in DB
  const settings = await db.platformSettings.findUnique({
    where: { id: 1 },
    select: { googleDriveFolderId: true },
  });

  return settings?.googleDriveFolderId || null;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export type DriveUploadResult = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
};

/**
 * Upload a file buffer to the configured Google Drive folder.
 * Returns the public view URL and file metadata.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  options?: { preserveExactName?: boolean },
): Promise<DriveUploadResult> {
  const folderId = await getConfiguredFolderId();

  if (!folderId) {
    throw new Error(
      "Google Drive folder not configured. Please set the folder link in Admin > Platform Settings (/admin/settings) or set GOOGLE_DRIVE_FOLDER_ID in environment variables.",
    );
  }

  const drive = getDriveClient();

  // Create a readable stream from the buffer
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  const finalName = options?.preserveExactName ? fileName : `${Date.now()}_${fileName}`;

  try {
    // Upload file to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: finalName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: "id,name,size,mimeType,webViewLink,webContentLink",
      supportsAllDrives: true,
    });

    const file = response.data;

    if (!file.id) {
      throw new Error("Google Drive upload returned no file ID.");
    }

    // Make the file readable by anyone with the link
    await drive.permissions.create({
      fileId: file.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    // Get the updated file with sharing link
    const updatedFile = await drive.files.get({
      fileId: file.id,
      fields: "id,name,size,mimeType,webViewLink,webContentLink",
      supportsAllDrives: true,
    });

    logger.info(
      { fileId: file.id, fileName, folderId },
      "File uploaded to Google Drive",
    );

    return {
      fileId: file.id,
      fileName,
      fileUrl:
        updatedFile.data.webViewLink ||
        `https://drive.google.com/file/d/${file.id}/view`,
      fileSizeBytes: parseInt(updatedFile.data.size || "0", 10) || fileBuffer.length,
      mimeType: updatedFile.data.mimeType || mimeType,
    };
  } catch (error: unknown) {
    logger.error({ error, fileName, folderId }, "Google Drive upload failed");
    const anyErr = error as {
      message?: string;
      response?: { data?: { error?: { message?: string } } };
      cause?: { message?: string };
    };
    const fullErrMsg =
      anyErr?.response?.data?.error?.message ||
      anyErr?.cause?.message ||
      anyErr?.message ||
      "";

    if (fullErrMsg.toLowerCase().includes("storage quota")) {
      throw new Error(
        "Google Drive Service Account quota limit: Service accounts have 0 MB storage quota in personal 'My Drive' folders. Please create a folder inside a Google Workspace 'Shared drive' and share it with the service account as Content Manager.",
      );
    }
    if (fullErrMsg.toLowerCase().includes("not found")) {
      throw new Error(
        `Google Drive folder (${folderId}) not found. Please verify the folder link in Admin > Platform Settings and ensure the folder is shared with the service account.`,
      );
    }
    throw new Error(
      fullErrMsg ||
        "Failed to upload file to Google Drive. Please check folder permissions and try again.",
    );
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Test whether the configured Google Drive folder is accessible.
 * Used by admin settings to validate the folder link.
 */
export async function testDriveFolderAccess(
  folderId: string,
): Promise<{ accessible: boolean; folderName?: string; isSharedDrive?: boolean; warning?: string; error?: string }> {
  try {
    const drive = getDriveClient();

    const response = await drive.files.get({
      fileId: folderId,
      fields: "id,name,mimeType,driveId",
      supportsAllDrives: true,
    });

    if (response.data.mimeType !== "application/vnd.google-apps.folder") {
      return {
        accessible: false,
        error: "The provided ID is not a Google Drive folder.",
      };
    }

    const isSharedDrive = Boolean(response.data.driveId);
    let warning: string | undefined = undefined;
    if (!isSharedDrive) {
      warning = "Note: This folder is in a personal drive. Google restricts service accounts from uploading to personal drives due to zero storage quota. If uploads fail, move this folder to a Google Workspace 'Shared drive'.";
    }

    return {
      accessible: true,
      folderName: response.data.name || "Unnamed Folder",
      isSharedDrive,
      warning,
    };
  } catch (error: unknown) {
    const statusCode = (error as { code?: number })?.code;
    if (statusCode === 404) {
      return {
        accessible: false,
        error:
          "Folder not found. Make sure the folder is shared with the service account email.",
      };
    }
    if (statusCode === 403) {
      return {
        accessible: false,
        error:
          "Access denied. Share the folder with the service account email as an Editor.",
      };
    }

    logger.error({ error, folderId }, "Error testing Drive folder access");
    return {
      accessible: false,
      error: "Could not verify folder access. Check credentials and try again.",
    };
  }
}

/**
 * Check if Google Drive credentials are configured in environment.
 */
export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

/**
 * Delete a file from Google Drive by its file ID.
 */
export async function deleteFromDrive(fileId: string): Promise<boolean> {
  if (!fileId || !isDriveConfigured()) return false;

  try {
    const drive = getDriveClient();
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    logger.info({ fileId }, "File deleted from Google Drive");
    return true;
  } catch (error) {
    logger.warn({ error, fileId }, "Failed to delete file from Google Drive");
    return false;
  }
}
