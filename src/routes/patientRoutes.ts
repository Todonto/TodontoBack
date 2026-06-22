import { Router } from "express";
import { patientController } from "../controllers/patientController";
import { authMiddleware } from "../middlewares/authMiddleware";

class PatientRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        // Pacientes
        this.router.post("/", authMiddleware, patientController.crearPaciente);
        this.router.get("/", authMiddleware, patientController.listarPacientes);
        this.router.get("/:id", authMiddleware, patientController.obtenerPaciente);
        this.router.put("/:id", authMiddleware, patientController.actualizarPaciente);
        this.router.delete("/:id", authMiddleware, patientController.desactivarPaciente);
        this.router.post("/appointments", authMiddleware, patientController.crearCita);

        // Documentos
        this.router.post("/documents", authMiddleware, patientController.subirDocumentos);
        this.router.get("/:id/documents", authMiddleware, patientController.listarDocumentos);
        this.router.get("/:id/documents/:docId", authMiddleware, patientController.obtenerDocumento);
        this.router.put("/:id/documents/:docId", authMiddleware, patientController.actualizarDocumento);
        this.router.delete("/:id/documents/:docId", authMiddleware, patientController.eliminarDocumento);

        // Historia dental y médica
        this.router.get("/:id/dental-history", authMiddleware, patientController.obtenerHistoriaDental);
        this.router.put("/:id/dental-history", authMiddleware, patientController.actualizarHistoriaDental);
        this.router.get("/:id/medical-history", authMiddleware, patientController.obtenerHistoriaMedica);
        this.router.put("/:id/medical-history", authMiddleware, patientController.actualizarHistoriaMedica);

        // Notas clinicas
        this.router.post("/:id/clinical-notes", authMiddleware, patientController.crearNotaClinica);
        this.router.get("/:id/clinical-notes", authMiddleware, patientController.listarNotasClinicas);
        this.router.get("/:id/clinical-notes/:noteId", authMiddleware, patientController.obtenerNotaClinica);
        this.router.put("/:id/clinical-notes/:noteId", authMiddleware, patientController.actualizarNotaClinica);
        this.router.delete("/:id/clinical-notes/:noteId", authMiddleware, patientController.eliminarNotaClinica);
    }
}

const patientRoutes = new PatientRoutes();
export default patientRoutes.router;