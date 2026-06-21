import { Router } from "express";
import { doctorController } from "../controllers/doctorController";
import { authMiddleware } from "../middlewares/authMiddleware";

class DoctorRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post("/configure", authMiddleware, doctorController.configurarConsultorio);
        this.router.get("/configure", authMiddleware, doctorController.obtenerConfiguracion);

        // Tratamientos
        this.router.post("/treatments", authMiddleware, doctorController.crearTratamiento);
        this.router.get("/treatments", authMiddleware, doctorController.listarTratamientos);
        this.router.get("/treatments/:id", authMiddleware, doctorController.obtenerTratamiento);
        this.router.put("/treatments/:id", authMiddleware, doctorController.actualizarTratamiento);
        this.router.delete("/treatments/:id", authMiddleware, doctorController.eliminarTratamiento);
    }
}

const doctorRoutes = new DoctorRoutes();
export default doctorRoutes.router;