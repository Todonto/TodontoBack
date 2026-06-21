import { Router } from "express";
import { patientController } from "../controllers/patientController";
import { authMiddleware } from "../middlewares/authMiddleware";

class PatientRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post("/", authMiddleware, patientController.crearPaciente);
        this.router.get("/", authMiddleware, patientController.listarPacientes);
        this.router.get("/:id", authMiddleware, patientController.obtenerPaciente);
        this.router.put("/:id", authMiddleware, patientController.actualizarPaciente);
        this.router.delete("/:id", authMiddleware, patientController.desactivarPaciente);
        this.router.post("/appointments", authMiddleware, patientController.crearCita);
        this.router.post("/documents", authMiddleware, patientController.subirDocumentos);
    }
}

const patientRoutes = new PatientRoutes();
export default patientRoutes.router;