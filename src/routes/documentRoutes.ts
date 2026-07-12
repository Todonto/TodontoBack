import { Router } from "express";
import { documentController } from "../controllers/documentController";
import { authMiddleware } from "../middlewares/authMiddleware";

class DocumentRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post("/", authMiddleware, documentController.subirDocumentos);
        this.router.get("/:id", authMiddleware, documentController.listarDocumentos);
        this.router.get("/:id/:docId", authMiddleware, documentController.obtenerDocumento);
        this.router.put("/:id/:docId", authMiddleware, documentController.actualizarDocumento);
        this.router.delete("/:id/:docId", authMiddleware, documentController.eliminarDocumento);
        this.router.put("/:id/:docId/file", authMiddleware, documentController.reemplazarArchivo);
    }
}

const documentRoutes = new DocumentRoutes();
export default documentRoutes.router;