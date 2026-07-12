import { Request, Response } from "express";
import supabase from "../database";
import { logError } from "../utils/logError";
import { validarFecha } from "../utils/validator";

class HistoryController {
    
    constructor() {
        this.obtenerHistoriaDental = this.obtenerHistoriaDental.bind(this);
        this.actualizarHistoriaDental = this.actualizarHistoriaDental.bind(this);
        this.obtenerHistoriaMedica = this.obtenerHistoriaMedica.bind(this);
        this.actualizarHistoriaMedica = this.actualizarHistoriaMedica.bind(this);
    }

    /**
     * GET /api/pat/:id/dental-history
     * Obtiene la historia dental de un paciente del doctor autenticado.
     */
    public async obtenerHistoriaDental(req: Request, res: Response) {
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

            const { data: historia, error } = await supabase
                .schema('clinica')
                .from('tHistoriaDental')
                .select('*')
                .eq('id_paciente', idPaciente)
                .maybeSingle();

            if (error) {
                await logError(req, error, 'HistoryController', 'obtenerHistoriaDental', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener la historia dental." });
            }

            if (!historia) {
                return res.status(404).json({ message: "Historia dental no encontrada para este paciente." });
            }

            res.status(200).json({ historia_dental: historia });

        } catch (err: any) {
            await logError(req, err, 'HistoryController', 'obtenerHistoriaDental', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * PUT /api/pat/:id/dental-history
     * Actualiza la historia dental de un paciente del doctor autenticado.
     * Solo los campos enviados serán modificados (actualización parcial).
     */
    public async actualizarHistoriaDental(req: Request, res: Response) {
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

            // Verificar que exista la historia dental
            const { data: historia, error: histError } = await supabase
                .schema('clinica')
                .from('tHistoriaDental')
                .select('id_historia_dental')
                .eq('id_paciente', idPaciente)
                .maybeSingle();

            if (histError || !historia) {
                return res.status(404).json({ message: "Historia dental no encontrada para este paciente." });
            }

            // Extraer campos del body
            const {
                motivo_consulta,
                cepillado_frecuencia,
                extracciones_previas,
                ultima_visita
            } = req.body;

            const datosActualizar: any = {};
            const errores: string[] = [];

            // Validaciones
            if (motivo_consulta !== undefined) {
                if (motivo_consulta === null || motivo_consulta === '') {
                    datosActualizar.motivo_consulta = null;
                } else if (typeof motivo_consulta === 'string') {
                    if (motivo_consulta.trim().length > 500) errores.push('El motivo de consulta no puede exceder 500 caracteres.');
                    else datosActualizar.motivo_consulta = motivo_consulta.trim();
                } else {
                    errores.push('El motivo de consulta debe ser un texto.');
                }
            }

            // cepillado_frecuencia: solo valores permitidos
            if (cepillado_frecuencia !== undefined) {
                const permitidos = ['1 vez', '2 veces', '3 o más'];
                if (cepillado_frecuencia === null || cepillado_frecuencia === '') {
                    datosActualizar.cepillado_frecuencia = null;
                } else if (!permitidos.includes(cepillado_frecuencia)) {
                    errores.push('Frecuencia de cepillado inválida. Use: 1 vez, 2 veces, 3 o más.');
                } else {
                    datosActualizar.cepillado_frecuencia = cepillado_frecuencia;
                }
            }

            // Campos booleanos
            const booleanFields = [
                'usa_hilo_dental', 'usa_enjuague', 'bruxismo', 'muerde_unas',
                'respiracion_bucal', 'tratamiento_ortodoncia', 'cirugia_oral',
                'sensibilidad_dental', 'sangrado_encias', 'dolor_articulacion'
            ];
            for (const field of booleanFields) {
                const val = (req.body as any)[field];
                if (val !== undefined) {
                    if (typeof val !== 'boolean') errores.push(`El campo ${field} debe ser booleano (true/false).`);
                    else datosActualizar[field] = val;
                }
            }

            // extracciones_previas: texto libre opcional, max 500
            if (extracciones_previas !== undefined) {
                if (extracciones_previas === null || extracciones_previas === '') {
                    datosActualizar.extracciones_previas = null;
                } else if (typeof extracciones_previas === 'string') {
                    if (extracciones_previas.trim().length > 500) errores.push('Extracciones previas no puede exceder 500 caracteres.');
                    else datosActualizar.extracciones_previas = extracciones_previas.trim();
                } else {
                    errores.push('Extracciones previas debe ser un texto.');
                }
            }

            if (ultima_visita !== undefined) {
                const errFecha = validarFecha(ultima_visita, 'última visita');
                if (errFecha) {
                    errores.push(errFecha);
                } else {
                    datosActualizar.ultima_visita = ultima_visita;
                }
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            if (Object.keys(datosActualizar).length === 0) {
                return res.status(400).json({ message: "No se enviaron campos para actualizar." });
            }

            // Actualizar fecha de actualización
            datosActualizar.fecha_actualizacion = new Date();

            const { data: actualizado, error: updateError } = await supabase
                .schema('clinica')
                .from('tHistoriaDental')
                .update(datosActualizar)
                .eq('id_paciente', idPaciente)
                .select('*')
                .single();

            if (updateError) {
                await logError(req, updateError, 'HistoryController', 'actualizarHistoriaDental', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar la historia dental." });
            }

            res.status(200).json({
                message: "Historia dental actualizada exitosamente.",
                historia_dental: actualizado
            });

        } catch (err: any) {
            await logError(req, err, 'HistoryController', 'actualizarHistoriaDental', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * GET /api/pat/:id/medical-history
     * Obtiene la historia médica de un paciente del doctor autenticado.
     */
    public async obtenerHistoriaMedica(req: Request, res: Response) {
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

            const { data: historia, error } = await supabase
                .schema('clinica')
                .from('tHistoriaMedica')
                .select('*')
                .eq('id_paciente', idPaciente)
                .maybeSingle();

            if (error) {
                await logError(req, error, 'HistoryController', 'obtenerHistoriaMedica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener la historia médica." });
            }

            if (!historia) {
                return res.status(404).json({ message: "Historia médica no encontrada para este paciente." });
            }

            res.status(200).json({ historia_medica: historia });

        } catch (err: any) {
            await logError(req, err, 'HistoryController', 'obtenerHistoriaMedica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * PUT /api/pat/:id/medical-history
     * Actualiza la historia médica de un paciente del doctor autenticado.
     * Solo los campos enviados serán modificados (actualización parcial).
     */
    public async actualizarHistoriaMedica(req: Request, res: Response) {
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

            // Verificar que exista la historia médica
            const { data: historia, error: histError } = await supabase
                .schema('clinica')
                .from('tHistoriaMedica')
                .select('id_historia_medica')
                .eq('id_paciente', idPaciente)
                .maybeSingle();

            if (histError || !historia) {
                return res.status(404).json({ message: "Historia médica no encontrada para este paciente." });
            }

            // Extraer campos del body
            const {
                otras_enfermedades, medicamentos_actuales,
                alergias_detalle, cirugias_previas, hospitalizaciones,
                fuma, alcohol
            } = req.body;

            const datosActualizar: any = {};
            const errores: string[] = [];

            // Campos booleanos
            const booleanFields = [
                'diabetes', 'hipertension', 'cardiopatia', 'epilepsia',
                'hepatitis', 'vih', 'tuberculosis', 'asma',
                'alergias_medicamentos', 'alergias_anestesicos', 'embarazo',
                'transfusiones', 'drogas'
            ];
            for (const field of booleanFields) {
                const val = (req.body as any)[field];
                if (val !== undefined) {
                    if (typeof val !== 'boolean') errores.push(`El campo ${field} debe ser booleano (true/false).`);
                    else datosActualizar[field] = val;
                }
            }

            // Campos de texto libre (máximo 500 caracteres)
            const textFields: { field: string; value: any }[] = [
                { field: 'otras_enfermedades', value: otras_enfermedades },
                { field: 'medicamentos_actuales', value: medicamentos_actuales },
                { field: 'alergias_detalle', value: alergias_detalle },
                { field: 'cirugias_previas', value: cirugias_previas },
                { field: 'hospitalizaciones', value: hospitalizaciones },
                { field: 'fuma', value: fuma },
                { field: 'alcohol', value: alcohol }
            ];

            for (const { field, value } of textFields) {
                if (value !== undefined) {
                    if (value === null || value === '') {
                        datosActualizar[field] = null;
                    } else if (typeof value === 'string') {
                        if (value.trim().length > 500) errores.push(`El campo ${field} no puede exceder 500 caracteres.`);
                        else datosActualizar[field] = value.trim();
                    } else {
                        errores.push(`El campo ${field} debe ser un texto.`);
                    }
                }
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            if (Object.keys(datosActualizar).length === 0) {
                return res.status(400).json({ message: "No se enviaron campos para actualizar." });
            }

            // Actualizar fecha de actualización
            datosActualizar.fecha_actualizacion = new Date();

            const { data: actualizado, error: updateError } = await supabase
                .schema('clinica')
                .from('tHistoriaMedica')
                .update(datosActualizar)
                .eq('id_paciente', idPaciente)
                .select('*')
                .single();

            if (updateError) {
                await logError(req, updateError, 'HistoryController', 'actualizarHistoriaMedica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar la historia médica." });
            }

            res.status(200).json({
                message: "Historia médica actualizada exitosamente.",
                historia_medica: actualizado
            });

        } catch (err: any) {
            await logError(req, err, 'HistoryController', 'actualizarHistoriaMedica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
}

export const historyController = new HistoryController();