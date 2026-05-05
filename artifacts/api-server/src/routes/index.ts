import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import useCasesRouter from "./use-cases";
import testCasesRouter from "./test-cases";
import testStepsRouter from "./test-steps";
import executionsRouter from "./executions";
import attachmentsRouter from "./attachments";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(useCasesRouter);
router.use(testCasesRouter);
router.use(testStepsRouter);
router.use(executionsRouter);
router.use(attachmentsRouter);
router.use(dashboardRouter);

export default router;
