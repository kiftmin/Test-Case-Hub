import { Router } from "express";
import { db, attachmentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateAttachmentBody } from "@workspace/api-zod";
import { authenticate } from "../middlewares/auth";
import { canAccessAttachmentEntity } from "../lib/access-control";

const router = Router();

router.get("/attachments/:entityType/:entityId", authenticate, async (req, res) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = parseInt(req.params.entityId as string);
    if (isNaN(entityId)) return res.status(400).json({ error: "Invalid entity ID" });

    if (!(await canAccessAttachmentEntity(req, entityType, entityId))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const attachments = await db.query.attachmentsTable.findMany({
      where: and(
        eq(attachmentsTable.entityType, entityType),
        eq(attachmentsTable.entityId, entityId),
      ),
      orderBy: desc(attachmentsTable.createdAt),
    });

    return res.json(attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list attachments");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attachments", authenticate, async (req, res) => {
  try {
    const body = CreateAttachmentBody.parse(req.body);

    if (!(await canAccessAttachmentEntity(req, body.entityType, body.entityId))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const [attachment] = await db
      .insert(attachmentsTable)
      .values({
        entityType: body.entityType,
        entityId: body.entityId,
        field: body.field,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        fileType: body.fileType,
      })
      .returning();

    return res.status(201).json({ ...attachment, createdAt: attachment.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create attachment");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/attachments/:attachmentId", authenticate, async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId as string);
    if (isNaN(attachmentId)) return res.status(400).json({ error: "Invalid attachment ID" });

    const existing = await db.query.attachmentsTable.findFirst({
      where: eq(attachmentsTable.id, attachmentId),
    });
    if (!existing) return res.status(404).json({ error: "Attachment not found" });

    if (!(await canAccessAttachmentEntity(req, existing.entityType, existing.entityId))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    await db.delete(attachmentsTable).where(eq(attachmentsTable.id, attachmentId));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete attachment");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
