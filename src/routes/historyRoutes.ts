import { Router } from "express";
import { historyController } from "../controllers/historyController";
import { authMiddleware } from "../middlewares/authMiddleware";

class HistoryRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.get("/:id/dental-history", authMiddleware, historyController.obtenerHistoriaDental);
        this.router.put("/:id/dental-history", authMiddleware, historyController.actualizarHistoriaDental);
        this.router.get("/:id/medical-history", authMiddleware, historyController.obtenerHistoriaMedica);
        this.router.put("/:id/medical-history", authMiddleware, historyController.actualizarHistoriaMedica);
    }
}

const historyRoutes = new HistoryRoutes();
export default historyRoutes.router;