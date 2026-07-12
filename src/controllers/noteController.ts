import { Request, Response } from "express";
import supabase from "../database";
import { logError } from "../utils/logError";

class NoteController {

    constructor() {
        this.crearNotaClinica = this.crearNotaClinica.bind(this);
        this.listarNotasClinicas = this.listarNotasClinicas.bind(this);
        this.obtenerNotaClinica = this.obtenerNotaClinica.bind(this);
        this.actualizarNotaClinica = this.actualizarNotaClinica.bind(this);
        this.eliminarNotaClinica = this.eliminarNotaClinica.bind(this);
    }

    /**
     * POST /api/pat/:id/clinical-notes
     * Crea una nota clínica para un paciente del doctor autenticado.
     * Opcionalmente asociada a una cita.
     */
    public async crearNotaClinica(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID de paciente requerido." });
            }
            const idString = Array.isArray(id) ? id[0] : id;
            const idPaciente = parseInt(idString!, 10);
            if (isNaN(idPaciente)) {
                return res.status(400).json({ message: "ID de paciente inválido." });
            }

            // Verificar que el paciente pertenezca al doctor
            const { data: paciente, error: pacError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();

            if (pacError || !paciente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            const {
                id_cita,
                subjetivo,
                objetivo,
                analisis,
                plan,
                notas_adicionales
            } = req.body;

            // Validar que al menos un campo de nota esté presente
            if (!subjetivo && !objetivo && !analisis && !plan && !notas_adicionales) {
                return res.status(400).json({ message: "Debe incluir al menos un campo de la nota clínica (subjetivo, objetivo, analisis, plan, notas_adicionales)." });
            }

            // Validar id_cita si se envía
            if (id_cita !== undefined && id_cita !== null) {
                if (typeof id_cita !== 'number' || id_cita <= 0) {
                    return res.status(400).json({ message: "ID de cita inválido." });
                }
                const { data: cita } = await supabase
                    .schema('clinica')
                    .from('tCita')
                    .select('id_cita, id_paciente')
                    .eq('id_cita', id_cita)
                    .eq('id_doctor', doctorId)
                    .maybeSingle();
                if (!cita) {
                    return res.status(404).json({ message: "Cita no encontrada o no pertenece a este doctor." });
                }
                if (cita.id_paciente !== idPaciente) {
                    return res.status(400).json({ message: "La cita no corresponde al paciente indicado." });
                }
            }

            // Validar longitud de textos (TEXT en BD, limitamos a 5000 caracteres por campo)
            const camposTexto: { campo: string; valor: any }[] = [
                { campo: 'subjetivo', valor: subjetivo },
                { campo: 'objetivo', valor: objetivo },
                { campo: 'analisis', valor: analisis },
                { campo: 'plan', valor: plan },
                { campo: 'notas_adicionales', valor: notas_adicionales }
            ];

            const datosInsert: any = {
                id_paciente: idPaciente,
                id_doctor: doctorId,
                id_cita: id_cita || null
            };
            const errores: string[] = [];

            for (const { campo, valor } of camposTexto) {
                if (valor !== undefined && valor !== null && valor !== '') {
                    if (typeof valor !== 'string') {
                        errores.push(`El campo ${campo} debe ser un texto.`);
                    } else if (valor.trim().length > 5000) {
                        errores.push(`El campo ${campo} no puede exceder 5000 caracteres.`);
                    } else {
                        datosInsert[campo] = valor.trim();
                    }
                }
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            const { data: nuevaNota, error: insertError } = await supabase
                .schema('clinica')
                .from('tNotaClinica')
                .insert(datosInsert)
                .select('*')
                .single();

            if (insertError) {
                await logError(req, insertError, 'NoteController', 'crearNotaClinica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al crear la nota clínica." });
            }

            res.status(201).json({
                message: "Nota clínica creada exitosamente.",
                nota_clinica: nuevaNota
            });

        } catch (err: any) {
            await logError(req, err, 'NoteController', 'crearNotaClinica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * GET /api/pat/:id/clinical-notes
     * Lista las notas clínicas de un paciente del doctor autenticado.
     * Query opcional: ?cita=:id_cita para filtrar por cita.
     */
    public async listarNotasClinicas(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID de paciente requerido." });
            }
            const idString = Array.isArray(id) ? id[0] : id;
            const idPaciente = parseInt(idString!, 10);
            if (isNaN(idPaciente)) {
                return res.status(400).json({ message: "ID de paciente inválido." });
            }

            // Verificar pertenencia del paciente
            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            let query = supabase
                .schema('clinica')
                .from('tNotaClinica')
                .select('*')
                .eq('id_paciente', idPaciente)
                .order('fecha_nota', { ascending: false });

            // Filtrar por cita si se especifica
            const { cita } = req.query;
            if (cita !== undefined) {
                const citaStr = Array.isArray(cita) ? cita[0] : cita;
                const idCita = parseInt(citaStr as string, 10);
                if (isNaN(idCita)) {
                    return res.status(400).json({ message: "El parámetro 'cita' debe ser un ID numérico." });
                }
                query = query.eq('id_cita', idCita);
            }

            const { data: notas, error } = await query;

            if (error) {
                await logError(req, error, 'NoteController', 'listarNotasClinicas', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener notas clínicas." });
            }

            res.status(200).json({ notas_clinicas: notas });

        } catch (err: any) {
            await logError(req, err, 'NoteController', 'listarNotasClinicas', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * GET /api/pat/:id/clinical-notes/:noteId
     * Obtiene una nota clínica específica.
     */
    public async obtenerNotaClinica(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const { id, noteId } = req.params;
            const idPaciente = parseInt(id as string, 10);
            const idNota = parseInt(noteId as string, 10);
            if (isNaN(idPaciente) || isNaN(idNota)) {
                return res.status(400).json({ message: "ID de paciente o nota inválido." });
            }

            // Verificar que el paciente pertenezca al doctor
            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            const { data: nota, error } = await supabase
                .schema('clinica')
                .from('tNotaClinica')
                .select('*')
                .eq('id_nota', idNota)
                .eq('id_paciente', idPaciente)
                .maybeSingle();

            if (error || !nota) {
                return res.status(404).json({ message: "Nota clínica no encontrada." });
            }

            res.status(200).json({ nota_clinica: nota });

        } catch (err: any) {
            await logError(req, err, 'NoteController', 'obtenerNotaClinica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * PUT /api/pat/:id/clinical-notes/:noteId
     * Actualiza una nota clínica (parcial).
     */
    public async actualizarNotaClinica(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const { id, noteId } = req.params;
            const idPaciente = parseInt(id as string, 10);
            const idNota = parseInt(noteId as string, 10);
            if (isNaN(idPaciente) || isNaN(idNota)) {
                return res.status(400).json({ message: "ID de paciente o nota inválido." });
            }

            // Verificar paciente y nota
            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            const { data: notaExistente } = await supabase
                .schema('clinica')
                .from('tNotaClinica')
                .select('id_nota')
                .eq('id_nota', idNota)
                .eq('id_paciente', idPaciente)
                .maybeSingle();
            if (!notaExistente) {
                return res.status(404).json({ message: "Nota clínica no encontrada." });
            }

            const {
                id_cita, subjetivo, objetivo, analisis, plan, notas_adicionales
            } = req.body;

            const datosActualizar: any = {};
            const errores: string[] = [];

            // Validar id_cita si se envía
            if (id_cita !== undefined) {
                if (id_cita === null) {
                    datosActualizar.id_cita = null;
                } else if (typeof id_cita !== 'number' || id_cita <= 0) {
                    errores.push("ID de cita inválido.");
                } else {
                    const { data: cita } = await supabase
                        .schema('clinica')
                        .from('tCita')
                        .select('id_cita, id_paciente')
                        .eq('id_cita', id_cita)
                        .eq('id_doctor', doctorId)
                        .maybeSingle();
                    if (!cita) errores.push("Cita no encontrada o no pertenece a este doctor.");
                    else if (cita.id_paciente !== idPaciente) errores.push("La cita no corresponde al paciente indicado.");
                    else datosActualizar.id_cita = id_cita;
                }
            }

            // Textos libres, máx 5000 caracteres
            const camposTexto = [
                { campo: 'subjetivo', valor: subjetivo },
                { campo: 'objetivo', valor: objetivo },
                { campo: 'analisis', valor: analisis },
                { campo: 'plan', valor: plan },
                { campo: 'notas_adicionales', valor: notas_adicionales }
            ];
            for (const { campo, valor } of camposTexto) {
                if (valor !== undefined) {
                    if (valor === null || valor === '') {
                        datosActualizar[campo] = null;
                    } else if (typeof valor === 'string') {
                        if (valor.trim().length > 5000) errores.push(`El campo ${campo} no puede exceder 5000 caracteres.`);
                        else datosActualizar[campo] = valor.trim();
                    } else {
                        errores.push(`El campo ${campo} debe ser un texto.`);
                    }
                }
            }

            if (errores.length > 0) return res.status(400).json({ errors: errores });
            if (Object.keys(datosActualizar).length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar." });

            datosActualizar.updated_at = new Date();

            const { data: actualizada, error: updateError } = await supabase
                .schema('clinica')
                .from('tNotaClinica')
                .update(datosActualizar)
                .eq('id_nota', idNota)
                .select('*')
                .single();

            if (updateError) {
                await logError(req, updateError, 'NoteController', 'actualizarNotaClinica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar la nota clínica." });
            }

            res.status(200).json({ message: "Nota clínica actualizada exitosamente.", nota_clinica: actualizada });

        } catch (err: any) {
            await logError(req, err, 'NoteController', 'actualizarNotaClinica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * DELETE /api/pat/:id/clinical-notes/:noteId
     * Elimina permanentemente una nota clínica.
     */
    public async eliminarNotaClinica(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) return res.status(401).json({ message: "No autorizado" });

            const { id, noteId } = req.params;
            const idPaciente = parseInt(id as string, 10);
            const idNota = parseInt(noteId as string, 10);
            if (isNaN(idPaciente) || isNaN(idNota)) return res.status(400).json({ message: "ID inválido." });

            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) return res.status(404).json({ message: "Paciente no encontrado." });

            const { data: nota } = await supabase
                .schema('clinica')
                .from('tNotaClinica')
                .select('id_nota')
                .eq('id_nota', idNota)
                .eq('id_paciente', idPaciente)
                .maybeSingle();
            if (!nota) return res.status(404).json({ message: "Nota clínica no encontrada." });

            const { error } = await supabase
                .schema('clinica')
                .from('tNotaClinica')
                .delete()
                .eq('id_nota', idNota);

            if (error) {
                await logError(req, error, 'NoteController', 'eliminarNotaClinica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al eliminar la nota clínica." });
            }

            res.status(200).json({ message: "Nota clínica eliminada correctamente." });

        } catch (err: any) {
            await logError(req, err, 'NoteController', 'eliminarNotaClinica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
}

export const noteController = new NoteController();