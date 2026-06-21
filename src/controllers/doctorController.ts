import { Request, Response } from "express";
import supabase from "../database";
import { logError } from "../utils/logError";
import multer from "multer";
import path from "path";
import crypto from "crypto";

// Configuración de multer para almacenar en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|svg|webp)$/i;
        if (!allowed.test(path.extname(file.originalname))) {
            return cb(new Error("Solo se permiten imágenes (JPG, PNG, SVG, WEBP)"));
        }
        cb(null, true);
    }
}).single("logo");

class DoctorController {

    constructor() {
        this.configurarConsultorio = this.configurarConsultorio.bind(this);
        this.obtenerConfiguracion = this.obtenerConfiguracion.bind(this);
        this.crearTratamiento = this.crearTratamiento.bind(this);
        this.listarTratamientos = this.listarTratamientos.bind(this);
        this.obtenerTratamiento = this.obtenerTratamiento.bind(this);
        this.actualizarTratamiento = this.actualizarTratamiento.bind(this);
        this.eliminarTratamiento = this.eliminarTratamiento.bind(this);
    }

    /**
     * POST /api/doc/configure
     * Recibe logo, horarios y tratamientos para
     * configurar el consultorio del doctor autenticado.
     */
    public configurarConsultorio(req: Request, res: Response) {
        // Usar multer para procesar el archivo.
        upload(req, res, async (err) => {
        if (err) {
            await logError(req, err, 'DoctorController', 'configurarConsultorio | upload', 'clinica', 'lDoctor');
            return res.status(400).json({ message: err.message });
        }

        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            // Extraer datos del body
            const { diasActivos, horaApertura, horaCierre, tratamientos, margenFin, notacion_odontograma } = req.body;

            // Validaciones básicas
            if (notacion_odontograma && !['FDI', 'UNIVERSAL', 'PALMER', 'HADERUP'].includes(notacion_odontograma)) {
              return res.status(400).json({ message: "Notación de odontograma no válida" });
            }
        
            if (!diasActivos || !horaApertura || !horaCierre) {
                return res.status(400).json({ message: "Días activos, hora de apertura y cierre son obligatorios" });
            }

            let diasArray: number[];
            try {
                diasArray = typeof diasActivos === 'string' ? JSON.parse(diasActivos) : diasActivos;
            } catch {
                return res.status(400).json({ message: "El formato de días activos es inválido" });
            }

            if (!Array.isArray(diasArray) || diasArray.length === 0) {
                return res.status(400).json({ message: "Debe seleccionar al menos un día laborable" });
            }

            // Validar que los días sean números entre 0 y 6
            const esValido = diasArray.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
            if (!esValido) {
                return res.status(400).json({ message: "Los días deben ser números entre 0 (Domingo) y 6 (Sábado)" });
            }

            // Validar formato de hora (HH:MM)
            const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!horaRegex.test(horaApertura) || !horaRegex.test(horaCierre)) {
                return res.status(400).json({ message: "Formato de hora inválido. Use HH:MM" });
            }

            if (horaApertura >= horaCierre) {
                return res.status(400).json({ message: "La hora de apertura debe ser anterior a la de cierre" });
            }

            const margen = margenFin ? parseInt(margenFin, 10) : 0;
            if (isNaN(margen) || margen < 0 || margen > 120) {
                return res.status(400).json({ message: "Margen de fin debe ser un número entre 0 y 120 minutos" });
            }

            // Procesar tratamientos
            let tratamientosArray: { nombre: string; descripcion: string; costo_sugerido: number;
            duracion_minutos: number; color: string; codigo: string; requiere_odontograma: string}[] = [];
            if (tratamientos) {
                try {
                    tratamientosArray = typeof tratamientos === 'string' ? JSON.parse(tratamientos) : tratamientos;
                } catch {
                    return res.status(400).json({ message: "Formato de tratamientos inválido" });
                }
                if (!Array.isArray(tratamientosArray)) {
                    return res.status(400).json({ message: "Tratamientos debe ser un arreglo" });
                }
                for (const t of tratamientosArray) {
                    if (!t.nombre || typeof t.nombre !== 'string' || t.nombre.trim().length === 0) {
                        return res.status(400).json({ message: "Cada tratamiento debe tener un nombre" });
                    }
                    if (!t.duracion_minutos || typeof t.duracion_minutos !== 'number' || t.duracion_minutos <= 0) {
                        return res.status(400).json({ message: "Cada tratamiento debe tener una duración positiva en minutos" });
                    }
                    if (t.costo_sugerido !== undefined && (typeof t.costo_sugerido !== 'number' || t.costo_sugerido < 0)) {
                        return res.status(400).json({ message: "El costo sugerido debe ser un número positivo" });
                    }
                    if (t.color !== undefined && typeof t.color === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(t.color)) {
                        return res.status(400).json({ message: "El color debe ser un hexadecimal válido (#RRGGBB)" });
                    }
                    if (t.requiere_odontograma !== undefined && typeof t.requiere_odontograma !== 'boolean') {
                        return res.status(400).json({ message: "El campo requiere_odontograma debe ser booleano" });
                    }
                }
            }

            // Subir logo si existe
            let logoUrl: string | null = null;
            if (req.file) {
                const fileExt = path.extname(req.file.originalname);
                const fileName = `logo_${doctorId}_${crypto.randomBytes(6).toString('hex')}${fileExt}`;
                const filePath = `logos/${fileName}`;

                const { error: uploadError } = await supabase
                    .storage
                    .from('clinica-imagenes')
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: true
                    });

                if (uploadError) {
                    await logError(req, uploadError, 'DoctorController', 'configurarConsultorio | upload', 'clinica', 'lDoctor', doctorId);
                    throw new Error(`Error al subir logo: ${uploadError.message}`);
                }

                // Obtener URL pública
                const { data: públicoData } = supabase
                    .storage
                    .from('clinica-imagenes')
                    .getPublicUrl(filePath);

                logoUrl = públicoData?.publicUrl || null;

                // Guardar la URL del logo en la tabla de usuario
                if (logoUrl) {
                    const { error: updateLogoError } = await supabase
                        .schema('usuario')
                        .from('tUsuario')
                        .update({ logo: logoUrl, updated_at: new Date() })
                        .eq('id_usuario', doctorId);

                    if (updateLogoError) {
                        await logError(req, updateLogoError, 'DoctorController', 'configurarConsultorio | logo', 'clinica', 'lDoctor', doctorId);
                    }
                }
            }

            const { error: updateNotacionError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .update({ 
                    notacion_odontograma: notacion_odontograma || 'FDI',
                    updated_at: new Date() 
                })
                .eq('id_usuario', doctorId);
                if (updateNotacionError) {
                    await logError(req, updateNotacionError, 'DoctorController', 'configurarConsultorio | notacion', 'clinica', 'lDoctor', doctorId);
                }

                // Reemplazar horarios del doctor
                // Eliminamos todos los existentes
                const { error: deleteHorarioError } = await supabase
                    .schema('clinica')
                    .from('tHorarioDoctor')
                    .delete()
                    .eq('id_doctor', doctorId);

                if (deleteHorarioError) {
                    await logError(req, deleteHorarioError, 'DoctorController', 'configurarConsultorio | deleteHorarios', 'clinica', 'lDoctor', doctorId);
                    return res.status(500).json({ message: "Error al limpiar horarios anteriores" });
                }

                // Insertar nuevos bloques (uno por día activo)
                const horariosInsert = diasArray.map((dia: number) => ({
                    id_doctor: doctorId,
                    dia_semana: dia,
                    hora_inicio: horaApertura,
                    hora_fin: horaCierre,
                    margen_fin_minutos: margen,
                    activo: true
                }));

                const { error: insertHorarioError } = await supabase
                    .schema('clinica')
                    .from('tHorarioDoctor')
                    .insert(horariosInsert);

                if (insertHorarioError) {
                    await logError(req, insertHorarioError, 'DoctorController', 'configurarConsultorio | insertHorarios', 'clinica', 'lDoctor', doctorId);
                    return res.status(500).json({ message: "Error al guardar horarios" });
                }

                // Reemplazar tratamientos
                const { error: deleteTratamientosError } = await supabase
                    .schema('clinica')
                    .from('tTratamiento')
                    .delete()
                    .eq('id_doctor', doctorId);

                if (deleteTratamientosError) {
                    await logError(req, deleteTratamientosError, 'DoctorController', 'configurarConsultorio | deleteTratamientos', 'clinica', 'lDoctor', doctorId);
                    return res.status(500).json({ message: "Error al limpiar tratamientos anteriores" });
                }

                if (tratamientosArray.length > 0) {
                    const tratamientosInsert = tratamientosArray.map(t => ({
                        id_doctor: doctorId,
                        codigo: t.codigo || t.nombre.toLowerCase().replace(/\s+/g, '_'),   // si envían código lo usa, si no, genera
                        nombre: t.nombre.trim(),
                        descripcion: t.descripcion || null,
                        costo_sugerido: t.costo_sugerido ?? null,
                        duracion_minutos: t.duracion_minutos,
                        color: t.color || null,
                        activo: true,
                        requiere_odontograma: t.requiere_odontograma ?? false
                    }));

                    const { error: insertTratError } = await supabase
                        .schema('clinica')
                        .from('tTratamiento')
                        .insert(tratamientosInsert);

                    if (insertTratError) {
                        await logError(req, insertTratError, 'DoctorController', 'configurarConsultorio_insertTratamientos', 'clinica', 'lDoctor', doctorId);
                        return res.status(500).json({ message: "Error al guardar tratamientos" });
                    }
                }

                res.status(200).json({
                    message: "Configuración guardada exitosamente",
                    logo_url: logoUrl,
                    horarios_guardados: diasArray.length,
                    tratamientos_guardados: tratamientosArray.length
                });

            } catch (error: any) {
                await logError(req, error, 'DoctorController', 'configurarConsultorio', 'clinica', 'lDoctor');
                res.status(500).json({ message: "Error interno del servidor" });
            }
        });
    }

    /**
     * GET /api/doctor/configuracion
     * Obtiene la configuración actual del doctor
     * (logo, horarios, tratamientos).
     */
    public async obtenerConfiguracion(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }
    
            // Obtener logo (de usuario)
            const { data: usuario, error: userError } = await supabase
                .schema('usuario')
                .from('tUsuario')
                .select('logo, notacion_odontograma')
                .eq('id_usuario', doctorId)
                .maybeSingle();
    
            if (userError) {
                await logError(req, userError, 'DoctorController', 'obtenerConfiguracion_usuario', 'clinica', 'lDoctor', doctorId);
            }
    
            // Obtener horarios
            const { data: horarios, error: horarioError } = await supabase
                .schema('clinica')
                .from('tHorarioDoctor')
                .select('dia_semana, hora_inicio, hora_fin, margen_fin_minutos, activo')
                .eq('id_doctor', doctorId)
                .order('dia_semana', { ascending: true });
    
            if (horarioError) {
                await logError(req, horarioError, 'DoctorController', 'obtenerConfiguracion_horarios', 'clinica', 'lDoctor', doctorId);
            }
    
            // Obtener tratamientos
            const { data: tratamientos, error: tratError } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .select('id_tratamiento, codigo, nombre, duracion_minutos, costo_sugerido, color, activo, requiere_odontograma')
                .eq('id_doctor', doctorId)
                .order('nombre', { ascending: true });
    
            if (tratError) {
                await logError(req, tratError, 'DoctorController', 'obtenerConfiguracion_tratamientos', 'clinica', 'lDoctor', doctorId);
            }
    
            res.status(200).json({
                logo_url: usuario?.logo || null,
                notacion_odontograma: usuario?.notacion_odontograma || 'FDI',
                horarios: horarios || [],
                tratamientos: tratamientos || []
            });
    
        } catch (error: any) {
            await logError(req, error, 'DoctorController', 'obtenerConfiguracion', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor" });
        }
    }
    
    /**
     * POST /api/doc/treatments
     * Crea un nuevo tratamiento para el doctor autenticado.
     */
    public async crearTratamiento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }
    
            const {
                codigo,
                nombre,
                descripcion,
                costo_sugerido,
                duracion_minutos,
                color,
                requiere_odontograma
            } = req.body;
    
            // Validaciones
            const errores: string[] = [];
    
            if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
                errores.push("El nombre del tratamiento es obligatorio.");
            } else if (nombre.trim().length > 50) {
                errores.push("El nombre del tratamiento no puede exceder 50 caracteres.");
            }
    
            if (duracion_minutos === undefined || duracion_minutos === null || typeof duracion_minutos !== 'number' || duracion_minutos <= 0) {
                errores.push("La duración en minutos es obligatoria y debe ser un número positivo.");
            }
    
            if (costo_sugerido !== undefined && costo_sugerido !== null) {
                if (typeof costo_sugerido !== 'number' || costo_sugerido < 0) {
                    errores.push("El costo sugerido debe ser un número positivo.");
                }
            }
    
            if (color !== undefined && color !== null && typeof color === 'string') {
                if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    errores.push("El color debe ser un hexadecimal válido (#RRGGBB).");
                }
            }
    
            if (requiere_odontograma !== undefined && typeof requiere_odontograma !== 'boolean') {
                errores.push("El campo requiere_odontograma debe ser booleano.");
            }
    
            // Validar código si se envía
            if (codigo !== undefined && codigo !== null && typeof codigo === 'string') {
                if (codigo.trim().length > 50) {
                    errores.push("El código no puede exceder 50 caracteres.");
                }
            }
    
            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }
    
            // Generar código automático si no se envió
            const codigoFinal = codigo?.trim() || nombre.trim().toLowerCase().replace(/\s+/g, '_');
    
            // Insertar tratamiento
            const { data: tratamiento, error: insertError } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .insert({
                    id_doctor: doctorId,
                    codigo: codigoFinal,
                    nombre: nombre.trim(),
                    descripcion: descripcion || null,
                    costo_sugerido: costo_sugerido ?? null,
                    duracion_minutos,
                    color: color || null,
                    activo: true,
                    requiere_odontograma: requiere_odontograma ?? false
                })
                .select('id_tratamiento, codigo, nombre, descripcion, costo_sugerido, duracion_minutos, color, activo, requiere_odontograma')
                .single();
    
            if (insertError) {
                await logError(req, insertError, 'DoctorController', 'crearTratamiento', 'clinica', 'lDoctor', doctorId);
                if (insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
                    return res.status(409).json({ message: "Ya existe un tratamiento con ese código para este doctor." });
                }
                return res.status(500).json({ message: "Error al crear el tratamiento." });
            }
    
            res.status(201).json({
                message: "Tratamiento creado exitosamente.",
                tratamiento
            });
    
        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'crearTratamiento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
    
    /**
     * GET /api/doc/treatments
     * Lista los tratamientos del doctor autenticado.
     * Query opcional: ?activo=true/false para filtrar.
     */
    public async listarTratamientos(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }
    
            // Filtrar por activo si se especifica
            const { activo } = req.query;
            let query = supabase
                .schema('clinica')
                .from('tTratamiento')
                .select('*')
                .eq('id_doctor', doctorId)
                .order('nombre', { ascending: true });
    
            if (activo !== undefined) {
                if (activo !== 'true' && activo !== 'false') {
                    return res.status(400).json({ message: "El parámetro 'activo' debe ser true o false." });
                }
                query = query.eq('activo', activo === 'true');
            }
    
            const { data: tratamientos, error } = await query;
    
            if (error) {
                await logError(req, error, 'DoctorController', 'listarTratamientos', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener tratamientos." });
            }
    
            res.status(200).json({ tratamientos });
    
        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'listarTratamientos', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
    
    /**
     * GET /api/doc/treatments/:id
     * Obtiene un tratamiento específico del doctor autenticado.
     */
    public async obtenerTratamiento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }
    
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID de tratamiento requerido." });
            }
          
            const idString = Array.isArray(id) ? id[0] : id;
            const idTratamiento = parseInt(idString!, 10);
            if (isNaN(idTratamiento)) {
                return res.status(400).json({ message: "ID de tratamiento inválido." });
            }
    
            const { data: tratamiento, error } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .select('*')
                .eq('id_tratamiento', idTratamiento)
                .eq('id_doctor', doctorId)
                .maybeSingle();
    
            if (error) {
                await logError(req, error, 'DoctorController', 'obtenerTratamiento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener el tratamiento." });
            }
    
            if (!tratamiento) {
                return res.status(404).json({ message: "Tratamiento no encontrado o no pertenece a este doctor." });
            }
    
            res.status(200).json({ tratamiento });
    
        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'obtenerTratamiento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
    
    /**
     * PUT /api/doc/treatments/:id
     * Actualiza un tratamiento del doctor autenticado.
     * Solo se actualizan los campos enviados (actualización parcial).
     */
    public async actualizarTratamiento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }
    
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID de tratamiento requerido." });
            }
          
            const idString = Array.isArray(id) ? id[0] : id;
            const idTratamiento = parseInt(idString!, 10);
    
            if (isNaN(idTratamiento)) {
                return res.status(400).json({ message: "ID de tratamiento inválido." });
            }
    
            // Verificar que el tratamiento exista y pertenezca al doctor
            const { data: existente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .select('id_tratamiento')
                .eq('id_tratamiento', idTratamiento)
                .eq('id_doctor', doctorId)
                .maybeSingle();
    
            if (fetchError) {
                await logError(req, fetchError, 'DoctorController', 'actualizarTratamiento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al verificar el tratamiento." });
            }
    
            if (!existente) {
                return res.status(404).json({ message: "Tratamiento no encontrado o no pertenece a este doctor." });
            }
    
            // Extraer campos del body (solo los que se quieran actualizar)
            const {
                codigo,
                nombre,
                descripcion,
                costo_sugerido,
                duracion_minutos,
                color,
                requiere_odontograma,
                activo
            } = req.body;
    
            const datosActualizar: any = {};
    
            // Validar y agregar cada campo si está presente
            if (codigo !== undefined) {
                if (typeof codigo !== 'string' || codigo.trim().length === 0 || codigo.trim().length > 50) {
                    return res.status(400).json({ message: "El código debe tener entre 1 y 50 caracteres." });
                }
                datosActualizar.codigo = codigo.trim();
            }
    
            if (nombre !== undefined) {
                if (typeof nombre !== 'string' || nombre.trim().length === 0) {
                    return res.status(400).json({ message: "El nombre del tratamiento es obligatorio y no puede estar vacío." });
                }
                if (nombre.trim().length > 50) {
                    return res.status(400).json({ message: "El nombre del tratamiento no puede exceder 50 caracteres." });
                }
                datosActualizar.nombre = nombre.trim();
            }
    
            if (descripcion !== undefined) {
                datosActualizar.descripcion = descripcion; // puede ser null para limpiar
            }
    
            if (costo_sugerido !== undefined) {
                if (costo_sugerido !== null && (typeof costo_sugerido !== 'number' || costo_sugerido < 0)) {
                    return res.status(400).json({ message: "El costo sugerido debe ser un número positivo o null." });
                }
                datosActualizar.costo_sugerido = costo_sugerido;
            }
    
            if (duracion_minutos !== undefined) {
                if (typeof duracion_minutos !== 'number' || duracion_minutos <= 0) {
                    return res.status(400).json({ message: "La duración debe ser un número positivo en minutos." });
                }
                datosActualizar.duracion_minutos = duracion_minutos;
            }
    
            if (color !== undefined) {
                if (color !== null && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) {
                    return res.status(400).json({ message: "El color debe ser un hexadecimal válido (#RRGGBB) o null." });
                }
                datosActualizar.color = color;
            }
    
            if (requiere_odontograma !== undefined) {
                if (typeof requiere_odontograma !== 'boolean') {
                return res.status(400).json({ message: "El campo requiere_odontograma debe ser booleano." });
                }
                datosActualizar.requiere_odontograma = requiere_odontograma;
            }
    
            if (activo !== undefined) {
                if (typeof activo !== 'boolean') {
                return res.status(400).json({ message: "El campo activo debe ser booleano." });
                }
                datosActualizar.activo = activo;
            }
    
            if (Object.keys(datosActualizar).length === 0) {
                return res.status(400).json({ message: "No se enviaron campos para actualizar." });
            }
    
            const { data: actualizado, error: updateError } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .update(datosActualizar)
                .eq('id_tratamiento', idTratamiento)
                .eq('id_doctor', doctorId)
                .select('*')
                .single();
    
            if (updateError) {
                await logError(req, updateError, 'DoctorController', 'actualizarTratamiento', 'clinica', 'lDoctor', doctorId);
                if (updateError.message?.includes('unique constraint') || updateError.message?.includes('duplicate key')) {
                    return res.status(409).json({ message: "Ya existe otro tratamiento con ese código para este doctor." });
                }
                return res.status(500).json({ message: "Error al actualizar el tratamiento." });
            }
    
            res.status(200).json({
                message: "Tratamiento actualizado exitosamente.",
                tratamiento: actualizado
            });
    
        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'actualizarTratamiento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
    
    /**
     * DELETE /api/doc/treatments/:id
     * Desactiva (soft delete) un tratamiento del doctor autenticado.
     */
    public async eliminarTratamiento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }
    
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID de tratamiento requerido." });
            }
    
            const idString = Array.isArray(id) ? id[0] : id;
            const idTratamiento = parseInt(idString!, 10);
            if (isNaN(idTratamiento)) {
                return res.status(400).json({ message: "ID de tratamiento inválido." });
            }
    
            // Verificar que el tratamiento exista y pertenezca al doctor
            const { data: existente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .select('id_tratamiento, activo')
                .eq('id_tratamiento', idTratamiento)
                .eq('id_doctor', doctorId)
                .maybeSingle();
    
            if (fetchError) {
                await logError(req, fetchError, 'DoctorController', 'eliminarTratamiento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al verificar el tratamiento." });
            }
    
            if (!existente) {
                return res.status(404).json({ message: "Tratamiento no encontrado o no pertenece a este doctor." });
            }
    
            if (!existente.activo) {
                return res.status(400).json({ message: "El tratamiento ya está desactivado." });
            }
    
            // Soft delete: desactivar
            const { error: updateError } = await supabase
                .schema('clinica')
                .from('tTratamiento')
                .update({ activo: false})
                .eq('id_tratamiento', idTratamiento);
    
            if (updateError) {
                await logError(req, updateError, 'DoctorController', 'eliminarTratamiento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al desactivar el tratamiento." });
            }
    
            res.status(200).json({ message: "Tratamiento desactivado correctamente." });
    
        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'eliminarTratamiento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
}

export const doctorController = new DoctorController();