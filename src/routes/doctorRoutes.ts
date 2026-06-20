import { Router } from "express";
import { doctorController } from "../controllers/doctorController";

class DoctorRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post("/configure", doctorController.configurarConsultorio);
        this.router.get("/configure", doctorController.obtenerConfiguracion);
    }
}

const doctorRoutes = new DoctorRoutes();
export default doctorRoutes.router;