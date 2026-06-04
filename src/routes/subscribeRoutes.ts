import { Router } from "express";
import { subscriptionController } from "../controllers/subscriptionController";
import { authMiddleware } from "../middlewares/authMiddleware";
import rateLimit from "express-rate-limit";

const trialLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 horas
    max: 3,
    message: { message: "Has superado el límite de intentos de prueba. Intenta de nuevo mañana." },
    standardHeaders: true,
    legacyHeaders: false
});

const subscribeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 5,
    message: { message: "Demasiados intentos. Intenta de nuevo en un minuto." },
    standardHeaders: true,
    legacyHeaders: false
});

class SubscribeRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config() : void {
        this.router.get("/plans", subscriptionController.getPlans);
        this.router.post("/trial", authMiddleware, trialLimiter, subscriptionController.startTrial);
        this.router.post("/subscribe", authMiddleware,subscribeLimiter, subscriptionController.subscribe);
        this.router.post("/change-plan", authMiddleware, subscriptionController.changePlan);
        this.router.post("/cancel", authMiddleware, subscriptionController.cancel);
    }
}

const subscribeRoutes = new SubscribeRoutes();
export default subscribeRoutes.router;