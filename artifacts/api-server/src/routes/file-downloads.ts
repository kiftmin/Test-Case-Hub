import { Router } from "express";
import path from "path";
import fs from "fs";
import { db, attachmentsTable } from "@workspace/db";
import { eq, or, like } from "drizzle-orm";
import { extractBearerOrQueryToken, verifyTokenPayload } from "../middlewares/auth";
import { canAccessAttachmentEntity } from "../lib/access-control";

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function safeFilename(raw: string): string | null {
  const filename = path.basename(raw);
  if (!filename || filename === "." || filename === "..") return null;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return filename;
}

/**
 * GET /uploads/:filename
 * Authenticated file download (Bearer header or ?access_token= for img/a tags).
 */
router.get("/uploads/:filename", async (req, res) => {
  try {
    const filename = safeFilename(req.params.filename as string);
    if (!filename) return res.status(400).json({ error: "Invalid filename" });

    const token = extractBearerOrQueryToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }

    let user;
    try {
      user = await verifyTokenPayload(token);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileUrl = `/uploads/${filename}`;
    const linked = await db.query.attachmentsTable.findMany({
      where: or(
        eq(attachmentsTable.fileUrl, fileUrl),
        like(attachmentsTable.fileUrl, `%/${filename}`),
      ),
    });

    if (linked.length > 0) {
      const reqWithUser = { ...req, user };
      let allowed = false;
      for (const att of linked) {
        if (await canAccessAttachmentEntity(reqWithUser as any, att.entityType, att.entityId)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    } else if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return res.sendFile(filePath);
  } catch (err) {
    req.log.error({ err }, "Failed to serve upload");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
