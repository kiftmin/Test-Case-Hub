import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import useCasesRouter from "./use-cases";
import testCasesRouter from "./test-cases";
import testStepsRouter from "./test-steps";
import executionsRouter from "./executions";
import attachmentsRouter from "./attachments";
import dashboardRouter from "./dashboard";
import uploadRouter from "./upload";
import usersRouter from "./users";
import assignmentsRouter from "./project-assignments";
import authRouter from "./auth";
import testRunsRouter from "./test-runs";
import defectsRouter from "./defects";
import bugsRouter from "./bugs";
import { authenticate } from "../middlewares/auth";


const router: IRouter = Router();

router.use(authenticate);

// Public routes
router.use("/auth", authRouter);
router.use("/health", healthRouter);

router.get("/", (req, res) => {
  res.json({ status: "running", message: "UAT Test Case Management System API" });
});

// Authenticated routes

router.use(projectsRouter);
router.use(useCasesRouter);
router.use(testCasesRouter);
router.use(testStepsRouter);
router.use(executionsRouter);
router.use(attachmentsRouter);
router.use(dashboardRouter);
router.use(uploadRouter);
router.use(usersRouter);
router.use(assignmentsRouter);
router.use(testRunsRouter);
router.use(defectsRouter);
router.use(bugsRouter);


export default router;
