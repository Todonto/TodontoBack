import { Router } from "express";
import { noteController } from "../controllers/noteController";
import { authMiddleware } from "../middlewares/authMiddleware";

class NoteRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post("/:id", authMiddleware, noteController.crearNotaClinica);
        this.router.get("/:id", authMiddleware, noteController.listarNotasClinicas);
        this.router.get("/:id/:noteId", authMiddleware, noteController.obtenerNotaClinica);
        this.router.put("/:id/:noteId", authMiddleware, noteController.actualizarNotaClinica);
        this.router.delete("/:id/:noteId", authMiddleware, noteController.eliminarNotaClinica);
    }
}

const noteRoutes = new NoteRoutes();
export default noteRoutes.router;