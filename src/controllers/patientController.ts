import { Request, Response } from "express";
import supabase from "../database";
import { logError } from "../utils/logError";
import multer from "multer";
import path from "path";
import { randomBytes } from 'crypto';

const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|svg|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;
    if (!allowed.test(path.extname(file.originalname))) {
      return cb(new Error("Formato de archivo no permitido (JPG, PNG, PDF, DOC, etc.)"));
    }
    cb(null, true);
  }
}).array("files", 10); // máximo 10 archivos a la vez

// Patrones por tipo de campo
const PATRONES: Record<string, RegExp> = {
    nombre: /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s'-]+$/,
    apellido: /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s'-]+$/,
    direccion: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÜüÑñ\s#.,;:'"()\-/&@]+$/,
    ciudad: /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s]+$/,
    estado: /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s]+$/,
    pais: /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s]+$/,
    codigoPostal: /^[A-Za-z0-9\s]+$/,
    parentesco: /^[A-Za-zÁÉÍÓÚáéíóúÜüÑñ\s'-]+$/,
    ocupacion: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÜüÑñ\s#.,;:'"()\-/&@]+$/,
    referido: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÜüÑñ\s#.,;:'"()\-/&@]+$/,
    libre: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÜüÑñ\s#.,;:'"()\-/&@]+$/
};

const EMOJI_REGEX = /\p{Emoji}/u;

function contieneControles(texto: string): boolean {
    for (let i = 0; i < texto.length; i++) {
        const code = texto.charCodeAt(i);
        if ((code >= 0x00 && code <= 0x1F) && code !== 0x09 && code !== 0x0A && code !== 0x0D) return true;
        if (code >= 0x7F && code <= 0x9F) return true;
    }
    return false;
}

function validarTexto(
    valor: any,
    campo: string,
    tipo: keyof typeof PATRONES,
    min: number = 0,
    max: number = 255,
    obligatorio: boolean = false
): string | null {
    // ¿Es obligatorio y no llegó?
    if (obligatorio && (valor === undefined || valor === null || valor === '')) {
        return `El campo ${campo} es obligatorio.`;
    }
    // Si no es obligatorio y está vacío, se permite
    if (!obligatorio && (valor === undefined || valor === null || valor === '')) {
        return null;
    }

    if (typeof valor !== 'string') {
        return `El campo ${campo} debe ser un texto.`;
    }

    const texto = valor.trim();

    if (min > 0 && texto.length < min) {
        return `El campo ${campo} debe tener al menos ${min} caracteres.`;
    }

    if (texto.length > max) {
        return `El campo ${campo} no puede exceder ${max} caracteres.`;
    }

    if (EMOJI_REGEX.test(texto)) {
        return `El campo ${campo} no puede contener emojis.`;
    }

    if (contieneControles(texto)) {
        return `El campo ${campo} contiene caracteres no permitidos.`;
    }

    if (PATRONES[tipo] && !PATRONES[tipo].test(texto)) {
        return `El campo ${campo} contiene caracteres no permitidos.`;
    }

    return null;
}

class PatientController {
    constructor() {
        this.crearPaciente = this.crearPaciente.bind(this);
        this.crearCita = this.crearCita.bind(this);
        this.listarPacientes = this.listarPacientes.bind(this);
        this.obtenerPaciente = this.obtenerPaciente.bind(this);
        this.actualizarPaciente = this.actualizarPaciente.bind(this);
        this.desactivarPaciente = this.desactivarPaciente.bind(this);
    }

    /**
     * POST /api/pat
     * Crea un paciente nuevo para el doctor autenticado.
     */
    public async crearPaciente(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            // Extraer campos del body
            const {
                nombre, apellido_paterno, apellido_materno,
                fecha_nacimiento, sexo,
                correo_electronico, telefono_principal, telefono_secundario,
                calle, numero_exterior, numero_interior,
                colonia, ciudad, estado, codigo_postal, pais,
                contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
                ocupacion, referido_por
            } = req.body;

            // Validaciones robustas
            const errores: string[] = [];

            // Obligatorios
            const errNombre = validarTexto(nombre, 'nombre', 'nombre', 2, 60, true);
            if (errNombre) errores.push(errNombre);

            const errTel = (() => {
                if (!telefono_principal) return 'El teléfono principal es obligatorio.';
                const tel = String(telefono_principal).replace(/[^\d+]/g, '');
                if (tel.length < 10 || tel.length > 15) return 'El teléfono principal debe tener entre 10 y 15 dígitos.';
                return null;
            })();
            if (errTel) errores.push(errTel);

            // Opcionales con validación de texto
            if (apellido_paterno !== undefined) {
                const err = validarTexto(apellido_paterno, 'apellido paterno', 'apellido', 2, 60);
                if (err) errores.push(err);
            }
            if (apellido_materno !== undefined) {
                const err = validarTexto(apellido_materno, 'apellido materno', 'apellido', 2, 60);
                if (err) errores.push(err);
            }
            if (fecha_nacimiento !== undefined) {
                if (typeof fecha_nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento)) {
                    errores.push('Formato de fecha inválido (YYYY-MM-DD).');
                } else {
                    const nacimiento = new Date(fecha_nacimiento);
                    if (isNaN(nacimiento.getTime())) {
                        errores.push('Fecha de nacimiento no válida.');
                    } else {
                        const hoy = new Date();
                        if (nacimiento > hoy) errores.push('La fecha de nacimiento no puede ser futura.');
                        const edad = hoy.getFullYear() - nacimiento.getFullYear();
                        if (edad > 110) errores.push('Edad no válida (mayor a 110 años).');
                    }
                }
            }
            if (sexo !== undefined && !['M', 'F', 'O'].includes(sexo)) {
                errores.push('Sexo inválido (M, F, O).');
            }
            if (correo_electronico !== undefined) {
                if (typeof correo_electronico === 'string' && correo_electronico.trim() !== '') {
                    const correo = correo_electronico.trim().toLowerCase();
                    if (correo.length > 150) errores.push('El correo no puede exceder 150 caracteres.');
                    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('Formato de correo inválido.');
                }
            }
            if (telefono_secundario !== undefined && telefono_secundario !== '') {
                const telSec = String(telefono_secundario).replace(/[^\d+]/g, '');
                if (telSec.length < 10 || telSec.length > 15) errores.push('El teléfono secundario debe tener entre 10 y 15 dígitos.');
            }

            // Dirección y otros campos opcionales
            const validacionesOpcionales: { campo: string; tipo: keyof typeof PATRONES; min: number; max: number }[] = [
                { campo: 'calle', tipo: 'direccion', min: 2, max: 100 },
                { campo: 'numero_exterior', tipo: 'libre', min: 1, max: 10 },
                { campo: 'numero_interior', tipo: 'libre', min: 1, max: 10 },
                { campo: 'colonia', tipo: 'direccion', min: 2, max: 80 },
                { campo: 'ciudad', tipo: 'ciudad', min: 2, max: 80 },
                { campo: 'estado', tipo: 'estado', min: 2, max: 50 },
                { campo: 'codigo_postal', tipo: 'codigoPostal', min: 4, max: 10 },
                { campo: 'pais', tipo: 'pais', min: 2, max: 50 },
                { campo: 'contacto_emergencia_nombre', tipo: 'nombre', min: 2, max: 120 },
                { campo: 'contacto_emergencia_parentesco', tipo: 'parentesco', min: 2, max: 50 },
                { campo: 'contacto_emergencia_telefono', tipo: 'libre', min: 10, max: 15 }, // validará solo dígitos después
                { campo: 'ocupacion', tipo: 'ocupacion', min: 2, max: 100 },
                { campo: 'referido_por', tipo: 'referido', min: 2, max: 100 }
            ];

            for (const opt of validacionesOpcionales) {
                const val = (req.body as any)[opt.campo];
                if (val !== undefined && val !== null && val !== '') {
                    const err = validarTexto(val, opt.campo, opt.tipo, opt.min, opt.max);
                    if (err) errores.push(err);
                    // Validación extra para teléfonos de emergencia (solo dígitos)
                    if (opt.campo === 'contacto_emergencia_telefono') {
                        const tel = String(val).replace(/[^\d+]/g, '');
                        if (tel.length < 10 || tel.length > 15) errores.push('El teléfono de emergencia debe tener entre 10 y 15 dígitos.');
                    }
                }
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            // Llamar a la función almacenada
            const { data: nuevoId, error: rpcError } = await supabase
                .schema('clinica')
                .rpc('crear_paciente', {
                    _id_doctor: doctorId,
                    _nombre: nombre.trim(),
                    _telefono_principal: telefono_principal.trim().replace(/[^\d+]/g, ''),
                    _apellido_paterno: apellido_paterno?.trim() || null,
                    _apellido_materno: apellido_materno?.trim() || null,
                    _fecha_nacimiento: fecha_nacimiento || null,
                    _sexo: sexo || null,
                    _correo_electronico: correo_electronico?.trim().toLowerCase() || null,
                    _telefono_secundario: telefono_secundario?.trim().replace(/[^\d+]/g, '') || null,
                    _calle: calle?.trim() || null,
                    _numero_exterior: numero_exterior?.trim() || null,
                    _numero_interior: numero_interior?.trim() || null,
                    _colonia: colonia?.trim() || null,
                    _ciudad: ciudad?.trim() || null,
                    _estado: estado?.trim() || null,
                    _codigo_postal: codigo_postal?.trim() || null,
                    _pais: pais?.trim() || 'México',
                    _contacto_emergencia_nombre: contacto_emergencia_nombre?.trim() || null,
                    _contacto_emergencia_parentesco: contacto_emergencia_parentesco?.trim() || null,
                    _contacto_emergencia_telefono: contacto_emergencia_telefono?.trim().replace(/[^\d+]/g, '') || null,
                    _ocupacion: ocupacion?.trim() || null,
                    _referido_por: referido_por?.trim() || null
                });

            if (rpcError) {
                await logError(req, rpcError, 'DoctorController', 'crearPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al crear el paciente." });
            }

            // Obtener el paciente completo recién creado
            const { data: paciente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*')
                .eq('id_paciente', nuevoId)
                .single();

            if (fetchError || !paciente) {
                await logError(req, fetchError || new Error('Paciente no encontrado después de crear'), 'DoctorController', 'crearPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(201).json({ message: "Paciente creado, pero no se pudo recuperar.", id_paciente: nuevoId });
            }

            res.status(201).json({
                message: "Paciente creado exitosamente.",
                paciente
            });

        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'crearPaciente', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * POST /api/pat/appointments
     * Crea una cita para un paciente (existente o nuevo).
     */
    public async crearCita(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const {
                fecha_hora_inicio,
                fecha_hora_fin,
                id_tratamiento,
                estado,
                tipo_cita,
                notas,
                color,
                // Datos del paciente
                id_paciente,
                nombre_nuevo,
                telefono_principal_nuevo,
                correo_nuevo
            } = req.body;

            // Validaciones básicas de la cita
            if (!fecha_hora_inicio || !fecha_hora_fin) {
                return res.status(400).json({ message: "fecha_hora_inicio y fecha_hora_fin son obligatorios." });
            }

            const inicio = new Date(fecha_hora_inicio);
            const fin = new Date(fecha_hora_fin);
            if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
                return res.status(400).json({ message: "Formato de fecha/hora inválido. Use ISO 8601." });
            }
            if (inicio >= fin) {
                return res.status(400).json({ message: "La fecha de inicio debe ser anterior a la de fin." });
            }

            // Validar estado si se envía
            if (estado && !['programada', 'confirmada', 'en_curso', 'completada', 'cancelada', 'no_asistio'].includes(estado)) {
                return res.status(400).json({ message: "Estado de cita no válido." });
            }

            // Validar id_tratamiento si se envía
            if (id_tratamiento !== undefined && id_tratamiento !== null) {
                if (typeof id_tratamiento !== 'number' || id_tratamiento <= 0) {
                    return res.status(400).json({ message: "ID de tratamiento inválido." });
                }
                // Verificar que el tratamiento pertenezca al doctor y esté activo
                const { data: tratamiento } = await supabase
                    .schema('clinica')
                    .from('tTratamiento')
                    .select('id_tratamiento')
                    .eq('id_tratamiento', id_tratamiento)
                    .eq('id_doctor', doctorId)
                    .eq('activo', true)
                    .maybeSingle();
                if (!tratamiento) {
                    return res.status(400).json({ message: "El tratamiento no existe, no pertenece a este doctor o está inactivo." });
                }
            }

            // Validar paciente
            if (id_paciente !== undefined && id_paciente !== null) {
                if (typeof id_paciente !== 'number' || id_paciente <= 0) {
                    return res.status(400).json({ message: "ID de paciente inválido." });
                }
                // No se deben enviar datos de nuevo paciente junto con id_paciente
                if (nombre_nuevo || telefono_principal_nuevo || correo_nuevo) {
                    return res.status(400).json({ message: "Si envía id_paciente, no debe enviar nombre_nuevo, telefono_principal_nuevo o correo_nuevo." });
                }
            } else {
                // Se requiere nombre y teléfono para nuevo paciente
                if (!nombre_nuevo || !telefono_principal_nuevo) {
                    return res.status(400).json({ message: "Debe proporcionar id_paciente o al menos nombre_nuevo y telefono_principal_nuevo." });
                }
                if (typeof nombre_nuevo !== 'string' || nombre_nuevo.trim().length === 0) {
                    return res.status(400).json({ message: "El nombre del nuevo paciente es obligatorio." });
                }
                const tel = String(telefono_principal_nuevo).replace(/[^\d+]/g, '');
                if (tel.length < 10 || tel.length > 15) {
                    return res.status(400).json({ message: "El teléfono del nuevo paciente debe tener entre 10 y 15 dígitos." });
                }
            }

            // Llamar a la función almacenada
            const { data, error } = await supabase
                .schema('clinica')
                .rpc('crear_cita_con_paciente', {
                    p_id_doctor: doctorId,
                    p_fecha_hora_inicio: inicio.toISOString(),
                    p_fecha_hora_fin: fin.toISOString(),
                    p_id_tratamiento: id_tratamiento ?? null,
                    p_estado: estado ?? 'programada',
                    p_tipo_cita: tipo_cita ?? null,
                    p_notas: notas ?? null,
                    p_color: color ?? null,
                    p_id_paciente: id_paciente ?? null,
                    p_nombre_nuevo: nombre_nuevo?.trim() ?? null,
                    p_telefono_principal_nuevo: telefono_principal_nuevo 
                    ? String(telefono_principal_nuevo).replace(/[^\d+]/g, '') 
                    : null,
                    p_correo_nuevo: correo_nuevo?.trim().toLowerCase() ?? null
                });

            if (error) {
                await logError(req, error, 'DoctorController', 'crearCita', 'clinica', 'lDoctor', doctorId);
                const msg = error.message || '';
                if (msg.includes('horario laboral') || msg.includes('margen')) {
                    return res.status(400).json({ message: msg });
                }
                if (msg.includes('solape') || msg.includes('ya tiene una cita')) {
                    return res.status(409).json({ message: msg });
                }
                if (msg.includes('Paciente inexistente')) {
                    return res.status(404).json({ message: msg });
                }
                return res.status(500).json({ message: "Error al crear la cita." });
            }

            // data devuelve (id_cita, id_paciente)
            res.status(201).json({
                message: "Cita creada exitosamente.",
                id_cita: data.id_cita,
                id_paciente: data.id_paciente
            });

        } catch (err: any) {
            await logError(req, err, 'DoctorController', 'crearCita', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * GET /api/pat
     * Lista pacientes del doctor autenticado.
     * Query params opcionales:
     *  - buscar: busca por nombre, apellido o teléfono
     *  - activo: 'true' o 'false' para filtrar por estado
     */
    public async listarPacientes(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) {
                return res.status(401).json({ message: "No autorizado" });
            }

            const { buscar, activo } = req.query;

            let query = supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*')
                .eq('id_doctor', doctorId)
                .order('nombre', { ascending: true });

            // Filtrar por estado (activo/inactivo)
            if (activo !== undefined) {
                const activoStr = Array.isArray(activo) ? activo[0] : activo;
                if (activoStr !== 'true' && activoStr !== 'false') {
                    return res.status(400).json({ message: "El parámetro 'activo' debe ser true o false." });
                }
                query = query.eq('activo', activoStr === 'true');
            }

            // Búsqueda por texto (nombre, apellidos, teléfono)
            if (buscar && typeof buscar === 'string' && buscar.trim().length > 0) {
                const termino = buscar.trim();
                // Usamos ilike para búsqueda insensible a mayúsculas y acentos (si la BD lo soporta)
                query = query.or(
                    `nombre.ilike.%${termino}%,apellido_paterno.ilike.%${termino}%,apellido_materno.ilike.%${termino}%,telefono_principal.ilike.%${termino}%`
                );
            } else if (buscar && typeof buscar !== 'string') {
                return res.status(400).json({ message: "El parámetro 'buscar' debe ser una cadena de texto." });
            }

            const { data: pacientes, error } = await query;

            if (error) {
                await logError(req, error, 'PatientController', 'listarPacientes', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener pacientes." });
            }

            res.status(200).json({ pacientes });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'listarPacientes', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * GET /api/pat/:id
     * Obtiene un paciente específico del doctor autenticado.
     */
    public async obtenerPaciente(req: Request, res: Response) {
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

            const { data: paciente, error } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('*')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();

            if (error) {
                await logError(req, error, 'PatientController', 'obtenerPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener el paciente." });
            }

            if (!paciente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            res.status(200).json({ paciente });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'obtenerPaciente', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * PUT /api/pat/:id
     * Actualiza los datos de un paciente (parcial).
     */
    public async actualizarPaciente(req: Request, res: Response) {
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

            // Verificar que el paciente exista y pertenezca al doctor
            const { data: existente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();

            if (fetchError) {
                await logError(req, fetchError, 'PatientController', 'actualizarPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al verificar el paciente." });
            }
            if (!existente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            // Extraer todos los campos editables
            const {
                nombre, apellido_paterno, apellido_materno,
                fecha_nacimiento, sexo,
                correo_electronico, telefono_principal, telefono_secundario
            } = req.body;

            const datosActualizar: any = {};
            const errores: string[] = [];

            // Obligatorio solo si se envía (pero al menos debe ser válido)
            if (nombre !== undefined) {
                const err = validarTexto(nombre, 'nombre', 'nombre', 2, 60, true);
                if (err) errores.push(err);
                else datosActualizar.nombre = (nombre as string).trim();
            }
            if (telefono_principal !== undefined) {
                if (typeof telefono_principal !== 'string' || telefono_principal.trim().length === 0) {
                    errores.push('El teléfono principal no puede estar vacío.');
                } else {
                    const tel = String(telefono_principal).replace(/[^\d+]/g, '');
                    if (tel.length < 10 || tel.length > 15) errores.push('El teléfono principal debe tener entre 10 y 15 dígitos.');
                    else datosActualizar.telefono_principal = tel;
                }
            }

            // Apellidos
            if (apellido_paterno !== undefined) {
                const err = validarTexto(apellido_paterno, 'apellido paterno', 'apellido', 2, 60);
                if (err) errores.push(err);
                else datosActualizar.apellido_paterno = (apellido_paterno as string).trim() || null;
            }
            if (apellido_materno !== undefined) {
                const err = validarTexto(apellido_materno, 'apellido materno', 'apellido', 2, 60);
                if (err) errores.push(err);
                else datosActualizar.apellido_materno = (apellido_materno as string).trim() || null;
            }
            if (fecha_nacimiento !== undefined) {
                if (typeof fecha_nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento)) {
                    errores.push('Formato de fecha inválido (YYYY-MM-DD).');
                } else {
                    const nacimiento = new Date(fecha_nacimiento);
                    if (isNaN(nacimiento.getTime())) {
                        errores.push('Fecha de nacimiento no válida.');
                    } else {
                        const hoy = new Date();
                        if (nacimiento > hoy) errores.push('La fecha de nacimiento no puede ser futura.');
                        const edad = hoy.getFullYear() - nacimiento.getFullYear();
                        if (edad > 110) errores.push('Edad no válida (mayor a 110 años).');
                        else datosActualizar.fecha_nacimiento = fecha_nacimiento;
                    }
                }
            }
            if (sexo !== undefined) {
                if (!['M', 'F', 'O'].includes(sexo)) errores.push('Sexo inválido (M, F, O).');
                else datosActualizar.sexo = sexo;
            }
            if (correo_electronico !== undefined) {
                if (correo_electronico === null || correo_electronico === '') {
                    datosActualizar.correo_electronico = null;
                } else if (typeof correo_electronico === 'string') {
                    const correo = correo_electronico.trim().toLowerCase();
                    if (correo.length > 150) errores.push('El correo no puede exceder 150 caracteres.');
                    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('Formato de correo inválido.');
                    else datosActualizar.correo_electronico = correo;
                }
            }
            if (telefono_secundario !== undefined) {
                if (telefono_secundario === null || telefono_secundario === '') {
                    datosActualizar.telefono_secundario = null;
                } else if (typeof telefono_secundario === 'string') {
                    const telSec = String(telefono_secundario).replace(/[^\d+]/g, '');
                    if (telSec.length < 10 || telSec.length > 15) errores.push('El teléfono secundario debe tener entre 10 y 15 dígitos.');
                    else datosActualizar.telefono_secundario = telSec;
                }
            }

            // Campos de dirección y otros
            const validacionesOpcionales = [
                { campo: 'calle', tipo: 'direccion' as const, min: 2, max: 100 },
                { campo: 'numero_exterior', tipo: 'libre' as const, min: 1, max: 10 },
                { campo: 'numero_interior', tipo: 'libre' as const, min: 1, max: 10 },
                { campo: 'colonia', tipo: 'direccion' as const, min: 2, max: 80 },
                { campo: 'ciudad', tipo: 'ciudad' as const, min: 2, max: 80 },
                { campo: 'estado', tipo: 'estado' as const, min: 2, max: 50 },
                { campo: 'codigo_postal', tipo: 'codigoPostal' as const, min: 4, max: 10 },
                { campo: 'pais', tipo: 'pais' as const, min: 2, max: 50 },
                { campo: 'contacto_emergencia_nombre', tipo: 'nombre' as const, min: 2, max: 120 },
                { campo: 'contacto_emergencia_parentesco', tipo: 'parentesco' as const, min: 2, max: 50 },
                { campo: 'contacto_emergencia_telefono', tipo: 'libre' as const, min: 10, max: 15 },
                { campo: 'ocupacion', tipo: 'ocupacion' as const, min: 2, max: 100 },
                { campo: 'referido_por', tipo: 'referido' as const, min: 2, max: 100 }
            ];

            for (const opt of validacionesOpcionales) {
                const val = (req.body as any)[opt.campo];
                if (val !== undefined) {
                    if (val === null || val === '') {
                        datosActualizar[opt.campo] = null;
                    } else {
                        const err = validarTexto(val, opt.campo, opt.tipo, opt.min, opt.max);
                        if (err) errores.push(err);
                        else {
                            let finalValue = (val as string).trim();
                            if (opt.campo === 'contacto_emergencia_telefono') {
                                finalValue = finalValue.replace(/[^\d+]/g, '');
                                if (finalValue.length < 10 || finalValue.length > 15) errores.push('El teléfono de emergencia debe tener entre 10 y 15 dígitos.');
                                else datosActualizar[opt.campo] = finalValue;
                            } else {
                                datosActualizar[opt.campo] = finalValue;
                            }
                        }
                    }
                }
            }

            if (errores.length > 0) {
                return res.status(400).json({ errors: errores });
            }

            if (Object.keys(datosActualizar).length === 0) {
                return res.status(400).json({ message: "No se enviaron campos para actualizar." });
            }

            datosActualizar.updated_at = new Date();

            const { data: actualizado, error: updateError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .update(datosActualizar)
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .select('*')
                .single();

            if (updateError) {
                await logError(req, updateError, 'PatientController', 'actualizarPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar el paciente." });
            }

            res.status(200).json({
                message: "Paciente actualizado exitosamente.",
                paciente: actualizado
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'actualizarPaciente', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * DELETE /api/pat/:id
     * Desactiva (soft delete) un paciente.
     */
    public async desactivarPaciente(req: Request, res: Response) {
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

            // Verificar que el paciente exista y pertenezca al doctor
            const { data: paciente, error: fetchError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente, activo')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();

            if (fetchError) {
                await logError(req, fetchError, 'PatientController', 'desactivarPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al verificar el paciente." });
            }

            if (!paciente) {
                return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });
            }

            if (!paciente.activo) {
                return res.status(400).json({ message: "El paciente ya está desactivado." });
            }

            // Soft delete: desactivar
            const { error: updateError } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .update({ activo: false, updated_at: new Date() })
                .eq('id_paciente', idPaciente);

            if (updateError) {
                await logError(req, updateError, 'PatientController', 'desactivarPaciente', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al desactivar el paciente." });
            }

            res.status(200).json({ message: "Paciente desactivado correctamente." });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'desactivarPaciente', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * POST /api/pat/documents
     * Sube uno o varios documentos para un paciente, vinculándolos opcionalmente a una cita.
     * Campos esperados (multipart/form-data):
     *  - id_paciente (obligatorio)
     *  - id_cita (opcional)
     *  - id_categoria (opcional)
     *  - descripcion (opcional)
     *  - files (múltiples archivos)
     */
    public subirDocumentos(req: Request, res: Response) {
        uploadDocuments(req, res, async (err) => {
            if (err) {
                await logError(req, err, 'DoctorController', 'subirDocumentos | upload', 'clinica', 'lDoctor');
                return res.status(400).json({ message: err.message });
            }

            try {
                const doctorId = (req as any).user?.id_usuario;
                if (!doctorId) {
                    return res.status(401).json({ message: "No autorizado" });
                }

                const { id_paciente, id_cita, id_categoria, descripcion } = req.body;
                const files = req.files as Express.Multer.File[];

                if (!files || files.length === 0) {
                    return res.status(400).json({ message: "Debe enviar al menos un archivo." });
                }

                // Validar id_paciente
                if (!id_paciente) {
                    return res.status(400).json({ message: "El id_paciente es obligatorio." });
                }
                const idPaciente = parseInt(id_paciente, 10);
                if (isNaN(idPaciente)) {
                    return res.status(400).json({ message: "id_paciente inválido." });
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

                // Validar id_cita si se proporciona
                let idCita: number | null = null;
                if (id_cita) {
                    idCita = parseInt(id_cita, 10);
                    if (isNaN(idCita)) {
                        return res.status(400).json({ message: "id_cita inválido." });
                    }
                    const { data: cita, error: citaError } = await supabase
                        .schema('clinica')
                        .from('tCita')
                        .select('id_cita, id_paciente')
                        .eq('id_cita', idCita)
                        .eq('id_doctor', doctorId)
                        .maybeSingle();

                    if (citaError || !cita) {
                        return res.status(404).json({ message: "Cita no encontrada o no pertenece a este doctor." });
                    }
                    if (cita.id_paciente !== idPaciente) {
                        return res.status(400).json({ message: "La cita no corresponde al paciente indicado." });
                    }
                }

                // Validar id_categoria si se proporciona
                if (id_categoria) {
                    const idCat = parseInt(id_categoria, 10);
                    if (isNaN(idCat)) {
                        return res.status(400).json({ message: "id_categoria inválido." });
                    }
                    const { data: categoria, error: catError } = await supabase
                        .schema('clinica')
                        .from('tCategoriaDocumento')
                        .select('id_categoria')
                        .eq('id_categoria', idCat)
                        .maybeSingle();

                    if (catError || !categoria) {
                        return res.status(400).json({ message: "Categoría de documento no válida." });
                    }
                }

                // Subir archivos y crear registros
                const documentosCreados: any[] = [];

                for (const file of files) {
                    const fileExt = path.extname(file.originalname);
                    const fileName = `doc_${doctorId}_${idPaciente}_${randomBytes(6).toString('hex')}${fileExt}`;
                    const filePath = `documentos/${fileName}`;

                    const { error: uploadError } = await supabase
                        .storage
                        .from('clinica-imagenes')
                        .upload(filePath, file.buffer, {
                            contentType: file.mimetype,
                            upsert: true
                        });

                    if (uploadError) {
                        await logError(req, uploadError, 'DoctorController', 'subirDocumentos | upload', 'clinica', 'lDoctor', doctorId);
                        continue;
                    }

                    const { data: urlData } = supabase
                        .storage
                        .from('clinica-imagenes')
                        .getPublicUrl(filePath);

                    const publicUrl = urlData?.publicUrl || null;

                    const { data: nuevoDoc, error: insertError } = await supabase
                        .schema('clinica')
                        .from('tDocumentoPaciente')
                        .insert({
                            id_paciente: idPaciente,
                            id_doctor: doctorId,
                            id_cita: idCita || null,
                            id_categoria: id_categoria ? parseInt(id_categoria, 10) : null,
                            nombre_archivo: file.originalname,
                            ruta_almacenamiento: publicUrl,
                            mime_type: file.mimetype,
                            tamanio_bytes: file.size,
                            descripcion: descripcion || null
                        })
                        .select('*')
                        .single();

                    if (insertError) {
                        await logError(req, insertError, 'DoctorController', 'subirDocumentos | insert', 'clinica', 'lDoctor', doctorId);
                    } else {
                        documentosCreados.push(nuevoDoc);
                    }
                }

                if (documentosCreados.length === 0) {
                    return res.status(500).json({ message: "No se pudo subir ningún documento." });
                }

                res.status(201).json({
                    message: `${documentosCreados.length} documento(s) subido(s) exitosamente.`,
                    documentos: documentosCreados
                });

            } catch (error: any) {
                await logError(req, error, 'DoctorController', 'subirDocumentos', 'clinica', 'lDoctor');
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });
    }

}

export const patientController = new PatientController();