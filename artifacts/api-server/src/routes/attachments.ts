import { Router } from "express";
import { db, attachmentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateAttachmentBody } from "@workspace/api-zod";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/attachments/:entityType/:entityId", authenticate, async (req, res) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = parseInt(req.params.entityId as string);
    if (isNaN(entityId)) return res.status(400).json({ error: "Invalid entity ID" });

    const attachments = await db.query.attachmentsTable.findMany({
      where: and(
        eq(attachmentsTable.entityType, entityType),
        eq(attachmentsTable.entityId, entityId),
      ),
      orderBy: desc(attachmentsTable.createdAt),
    });

    res.json(attachments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list attachments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attachments", async (req, res) => {
  try {
    const body = CreateAttachmentBody.parse(req.body);

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

    res.status(201).json({ ...attachment, createdAt: attachment.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create attachment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/attachments/:attachmentId", async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    if (isNaN(attachmentId)) return res.status(400).json({ error: "Invalid attachment ID" });

    await db.delete(attachmentsTable).where(eq(attachmentsTable.id, attachmentId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete attachment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
