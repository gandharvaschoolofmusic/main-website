import { db } from "@/lib/db";
import { UAParser } from "ua-parser-js";
import { verifyTotpCode } from "@/lib/totp";
import { logger } from "@/lib/logger";

export interface DeviceSessionInfo {
  id: string;
  sessionId: string;
  deviceName: string;
  browser: string;
  os: string;
  ip: string;
  country: string | null;
  loginAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  isRevoked: boolean;
}

/**
 * Parses user agent string into friendly device name, browser, and OS.
 */
export function parseUserAgentMetadata(uaString?: string | null): {
  deviceName: string;
  browser: string;
  os: string;
} {
  if (!uaString) {
    return {
      deviceName: "Unknown Device",
      browser: "Unknown Browser",
      os: "Unknown OS",
    };
  }

  try {
    const parser = new UAParser(uaString);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const browserName = browser.name ? `${browser.name} ${browser.major || ""}`.trim() : "Web Browser";
    const osName = os.name ? `${os.name} ${os.version || ""}`.trim() : "Unknown OS";

    let deviceName = "Desktop";
    if (device.type === "mobile") {
      deviceName = device.model || device.vendor || "Mobile Device";
    } else if (device.type === "tablet") {
      deviceName = device.model || device.vendor || "Tablet";
    } else if (os.name) {
      deviceName = `${os.name} PC`;
    }

    return {
      deviceName: deviceName.trim(),
      browser: browserName,
      os: osName,
    };
  } catch {
    return {
      deviceName: "Desktop Browser",
      browser: "Web Browser",
      os: "Desktop OS",
    };
  }
}

/**
 * Registers or updates an active admin device session.
 */
export async function syncAdminDeviceSession({
  userId,
  sessionId,
  userAgent,
  ip,
  country,
}: {
  userId: string;
  sessionId: string;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
}) {
  if (!userId || !sessionId) return null;

  try {
    const { deviceName, browser, os } = parseUserAgentMetadata(userAgent);
    const cleanIp = ip ? ip.split(",")[0].trim() : "127.0.0.1";

    const session = await db.adminDeviceSession.upsert({
      where: { sessionId },
      update: {
        lastSeenAt: new Date(),
        // Update device info if previously unknown
        ...(deviceName && { deviceName }),
        ...(browser && { browser }),
        ...(os && { os }),
        ...(cleanIp && { ip: cleanIp }),
        ...(country && { country }),
      },
      create: {
        userId,
        sessionId,
        deviceName,
        browser,
        os,
        ip: cleanIp,
        country: country || null,
        loginAt: new Date(),
        lastSeenAt: new Date(),
        isRevoked: false,
      },
    });

    return session;
  } catch (err) {
    logger.warn({ err, userId, sessionId }, "Failed to sync admin device session");
    return null;
  }
}

/**
 * Retrieve all active and recent device sessions for an admin user.
 */
export async function getAdminDeviceSessionsList(
  userId: string,
  currentSessionId?: string
): Promise<DeviceSessionInfo[]> {
  try {
    const sessions = await db.adminDeviceSession.findMany({
      where: {
        userId,
        isRevoked: false,
      },
      orderBy: {
        lastSeenAt: "desc",
      },
      take: 20,
    });

    return sessions.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      deviceName: s.deviceName || "Unknown Device",
      browser: s.browser || "Web Browser",
      os: s.os || "Desktop OS",
      ip: s.ip || "Unknown IP",
      country: s.country,
      loginAt: s.loginAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      isCurrent: s.sessionId === currentSessionId,
      isRevoked: s.isRevoked,
    }));
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch admin device sessions");
    return [];
  }
}

/**
 * Revokes an admin device session after verifying TOTP code with Google Authenticator.
 */
export async function revokeAdminDeviceSession({
  adminUserId,
  targetSessionId,
  totpCode,
}: {
  adminUserId: string;
  targetSessionId: string;
  totpCode: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const admin = await db.user.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!admin || admin.role !== "ADMIN") {
      return { success: false, error: "Unauthorized operation." };
    }

    if (!admin.twoFactorEnabled || !admin.twoFactorSecret) {
      return {
        success: false,
        error: "Google Authenticator 2FA must be configured on your account before revoking devices.",
      };
    }

    const cleanCode = (totpCode || "").trim().replace(/[\s-]/g, "");
    if (!cleanCode) {
      return { success: false, error: "Please enter the 6-digit Google Authenticator code." };
    }

    let isVerified = false;

    // 1. Verify standard 6-digit TOTP code
    if (/^\d{6}$/.test(cleanCode)) {
      isVerified = verifyTotpCode(admin.twoFactorSecret, cleanCode);
    }

    // 2. Allow emergency backup recovery codes
    if (!isVerified && admin.twoFactorBackupCodes) {
      try {
        const backupList: string[] = JSON.parse(admin.twoFactorBackupCodes);
        const index = backupList.findIndex(
          (b) => b.toUpperCase().replace(/[\s-]/g, "") === cleanCode.toUpperCase()
        );
        if (index !== -1) {
          isVerified = true;
          // Consume used backup code
          backupList.splice(index, 1);
          await db.user.update({
            where: { id: admin.id },
            data: { twoFactorBackupCodes: JSON.stringify(backupList) },
          });
        }
      } catch (backupErr) {
        logger.warn({ backupErr }, "Failed processing backup code for session revocation");
      }
    }

    if (!isVerified) {
      return {
        success: false,
        error: "Invalid Google Authenticator code. Please enter the current 6-digit code from your authenticator app.",
      };
    }

    // Revoke the session in database
    await db.adminDeviceSession.updateMany({
      where: {
        sessionId: targetSessionId,
        userId: adminUserId,
      },
      data: {
        isRevoked: true,
      },
    });

    return {
      success: true,
      message: "Device access revoked successfully. That device has been disconnected.",
    };
  } catch (err: any) {
    logger.error({ err, adminUserId, targetSessionId }, "Error revoking device session");
    return {
      success: false,
      error: err?.message || "Failed to revoke device session.",
    };
  }
}

