import { Router } from "express";
import { db, teamDiscussionsTable, teamDiscussionParticipantsTable, defectsTable, defectNotesTable, testRunsTable, projectsTable, projectAssignmentsTable, usersTable, testCasesTable, testStepsTable, executionsTable, stepResultsTable, attachmentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { authenticate, checkProjectRole } from "../middlewares/auth";

const router = Router();

const CreateDiscussionBody = z.object({
  meetingType: z.enum(["defect_review", "post_mortem"]),
  participantIds: z.array(z.number()),
});

const AddParticipantBody = z.object({
  userId: z.number(),
  canAddNotes: z.boolean().default(false),
});

async function assertTestLeadOrAdmin(req: any, res: any, projectId: number): Promise<boolean> {
  if (req.user!.role === "ADMIN") return true;
  const assignment = await db.query.projectAssignmentsTable.findFirst({
    where: and(
      eq(projectAssignmentsTable.projectId, projectId),
      eq(projectAssignmentsTable.userId, req.user!.userId),
    ),
  });
  if (!assignment || !["TEST_LEAD"].includes(assignment.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

function defaultCanAddNotes(meetingType: string): boolean {
  return meetingType === "post_mortem";
}

router.post("/test-runs/:testRunId/discussions", authenticate, async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    if (isNaN(testRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    const body = CreateDiscussionBody.parse(req.body);

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });

    const allowed = await checkProjectRole(req, run.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const [discussion] = await db.insert(teamDiscussionsTable).values({
      projectId: run.projectId,
      testRunId,
      initiatedByUserId: req.user!.userId,
      meetingType: body.meetingType,
    }).returning();

    const canAddNotes = defaultCanAddNotes(body.meetingType);
    for (const userId of body.participantIds) {
      await db.insert(teamDiscussionParticipantsTable).values({
        discussionId: discussion.id,
        userId,
        canAddNotes,
      }).onConflictDoNothing();
    }

    res.status(201).json({
      ...discussion,
      createdAt: discussion.createdAt.toISOString(),
      endedAt: discussion.endedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create discussion");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/discussions/:discussionId", authenticate, async (req, res) => {
  try {
    const discussionId = parseInt(req.params.discussionId as string);
    if (isNaN(discussionId)) return res.status(400).json({ error: "Invalid discussion ID" });

    const discussion = await db.query.teamDiscussionsTable.findFirst({
      where: eq(teamDiscussionsTable.id, discussionId),
      with: {
        initiatedBy: { columns: { id: true, name: true, username: true } },
        participants: {
          with: {
            user: { columns: { id: true, name: true, username: true } },
          },
        },
      },
    });

    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const isParticipant = discussion.participants.some(p => p.userId === req.user!.userId);
    if (req.user!.role !== "ADMIN" && !isParticipant) {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, discussion.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!assignment || !["TEST_LEAD"].includes(assignment.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    res.json({
      ...discussion,
      createdAt: discussion.createdAt.toISOString(),
      endedAt: discussion.endedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get discussion");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/discussions/:discussionId/participants", authenticate, async (req, res) => {
  try {
    const discussionId = parseInt(req.params.discussionId as string);
    if (isNaN(discussionId)) return res.status(400).json({ error: "Invalid discussion ID" });

    const body = AddParticipantBody.parse(req.body);

    const discussion = await db.query.teamDiscussionsTable.findFirst({
      where: eq(teamDiscussionsTable.id, discussionId),
    });
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const allowed = await checkProjectRole(req, discussion.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const existing = await db.query.teamDiscussionParticipantsTable.findFirst({
      where: and(
        eq(teamDiscussionParticipantsTable.discussionId, discussionId),
        eq(teamDiscussionParticipantsTable.userId, body.userId),
      ),
    });
    if (existing) return res.status(409).json({ error: "User is already a participant" });

    const [participant] = await db.insert(teamDiscussionParticipantsTable).values({
      discussionId,
      userId: body.userId,
      canAddNotes: body.canAddNotes,
    }).returning();

    res.status(201).json({
      ...participant,
      addedAt: participant.addedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add participant");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/discussions/:discussionId/participants/:userId", authenticate, async (req, res) => {
  try {
    const discussionId = parseInt(req.params.discussionId as string);
    const userId = parseInt(req.params.userId as string);
    if (isNaN(discussionId) || isNaN(userId)) return res.status(400).json({ error: "Invalid discussion or user ID" });

    const discussion = await db.query.teamDiscussionsTable.findFirst({
      where: eq(teamDiscussionsTable.id, discussionId),
    });
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const allowed = await checkProjectRole(req, discussion.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    await db.delete(teamDiscussionParticipantsTable)
      .where(and(
        eq(teamDiscussionParticipantsTable.discussionId, discussionId),
        eq(teamDiscussionParticipantsTable.userId, userId),
      ));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove participant");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/discussions/:discussionId/end", authenticate, async (req, res) => {
  try {
    const discussionId = parseInt(req.params.discussionId as string);
    if (isNaN(discussionId)) return res.status(400).json({ error: "Invalid discussion ID" });

    const discussion = await db.query.teamDiscussionsTable.findFirst({
      where: eq(teamDiscussionsTable.id, discussionId),
    });
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const allowed = await checkProjectRole(req, discussion.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    await db.update(teamDiscussionsTable)
      .set({ isActive: false, endedAt: new Date() })
      .where(eq(teamDiscussionsTable.id, discussionId));

    const updated = await db.query.teamDiscussionsTable.findFirst({
      where: eq(teamDiscussionsTable.id, discussionId),
    });

    res.json({
      ...updated,
      createdAt: updated!.createdAt.toISOString(),
      endedAt: updated!.endedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to end discussion");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/discussions/:discussionId/defects/:defectId", authenticate, async (req, res) => {
  try {
    const discussionId = parseInt(req.params.discussionId as string);
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(discussionId) || isNaN(defectId)) return res.status(400).json({ error: "Invalid discussion or defect ID" });

    const discussion = await db.query.teamDiscussionsTable.findFirst({
      where: eq(teamDiscussionsTable.id, discussionId),
    });
    if (!discussion) return res.status(404).json({ error: "Discussion not found" });

    const isParticipant = await db.query.teamDiscussionParticipantsTable.findFirst({
      where: and(
        eq(teamDiscussionParticipantsTable.discussionId, discussionId),
        eq(teamDiscussionParticipantsTable.userId, req.user!.userId),
      ),
    });
    if (req.user!.role !== "ADMIN" && !isParticipant) {
      return res.status(403).json({ error: "Only participants can view defect details" });
    }

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });
    if (!defect) return res.status(404).json({ error: "Defect not found" });

    const testCase = await db.query.testCasesTable.findFirst({
      where: eq(testCasesTable.id, defect.testCaseId),
      with: {
        steps: true,
      },
    });

    const execution = await db.query.executionsTable.findFirst({
      where: eq(executionsTable.id, defect.executionId),
      with: {
        stepResults: {
          with: {
            attachments: true,
          },
        },
      },
    });

    res.json({
      defect: {
        ...defect,
        createdAt: defect.createdAt.toISOString(),
        updatedAt: defect.updatedAt.toISOString(),
      },
      testCase: testCase ? {
        ...testCase,
        steps: testCase.steps.map(s => ({
          ...s,
          attachments: [],
        })),
      } : null,
      execution: execution ? {
        ...execution,
        executedAt: execution.executedAt.toISOString(),
        stepResults: execution.stepResults.map(sr => ({
          ...sr,
          recordedAt: sr.recordedAt.toISOString(),
          attachments: sr.attachments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
        })),
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get defect drill-down");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
