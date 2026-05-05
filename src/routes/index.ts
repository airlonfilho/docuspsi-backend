import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import profileRouter from "./profile.js";
import patientsRouter from "./patients.js";
import templatesRouter from "./templates.js";
import documentsRouter from "./documents.js";
import dashboardRouter from "./dashboard.js";
import publicRouter from "./public.js";
import uploadsRouter from "./uploads.js";
import leadsRouter from "./leads.js";
import plansRouter from "./plans.js";
import subscriptionsRouter from "./subscriptions.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/patients", patientsRouter);
router.use("/templates", templatesRouter);
router.use("/documents", documentsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/public", publicRouter);
router.use("/uploads", uploadsRouter);
router.use("/leads", leadsRouter);
router.use("/plans", plansRouter);
router.use("/subscriptions", subscriptionsRouter);

export default router;
