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

        this.listarDocumentos = this.listarDocumentos.bind(this);
        this.obtenerDocumento = this.obtenerDocumento.bind(this);
        this.actualizarDocumento = this.actualizarDocumento.bind(this);
        this.eliminarDocumento = this.eliminarDocumento.bind(this);

        this.obtenerHistoriaDental = this.obtenerHistoriaDental.bind(this);
        this.actualizarHistoriaDental = this.actualizarHistoriaDental.bind(this);
        this.obtenerHistoriaMedica = this.obtenerHistoriaMedica.bind(this);
        this.actualizarHistoriaMedica = this.actualizarHistoriaMedica.bind(this);

        this.crearNotaClinica = this.crearNotaClinica.bind(this);
        this.listarNotasClinicas = this.listarNotasClinicas.bind(this);
        this.obtenerNotaClinica = this.obtenerNotaClinica.bind(this);
        this.actualizarNotaClinica = this.actualizarNotaClinica.bind(this);
        this.eliminarNotaClinica = this.eliminarNotaClinica.bind(this);

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
     * Sube uno o varios documentos para un paciente,
     * vinculándolos opcionalmente a una cita.
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

    /**
     * GET /api/pat/:id/documents
     * Lista los documentos de un paciente, con filtros opcionales
     * por cita y categoría.
     */
    public async listarDocumentos(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) return res.status(401).json({ message: "No autorizado" });

            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID de paciente requerido." });
            const idString = Array.isArray(id) ? id[0] : id;
            const idPaciente = parseInt(idString!, 10);
            if (isNaN(idPaciente)) return res.status(400).json({ message: "ID de paciente inválido." });

            // Verificar pertenencia del paciente
            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });

            let query = supabase
                .schema('clinica')
                .from('tDocumentoPaciente')
                .select('*')
                .eq('id_paciente', idPaciente)
                .order('fecha_subida', { ascending: false });

            // Filtro por cita
            const { cita } = req.query;
            if (cita !== undefined) {
                const citaStr = Array.isArray(cita) ? cita[0] : cita;
                const idCita = parseInt(citaStr as string, 10);
                if (isNaN(idCita)) return res.status(400).json({ message: "El parámetro 'cita' debe ser un ID numérico." });
                query = query.eq('id_cita', idCita);
            }

            // Filtro por categoría
            const { categoria } = req.query;
            if (categoria !== undefined) {
                const catStr = Array.isArray(categoria) ? categoria[0] : categoria;
                const idCategoria = parseInt(catStr as string, 10);
                if (isNaN(idCategoria)) return res.status(400).json({ message: "El parámetro 'categoria' debe ser un ID numérico." });
                query = query.eq('id_categoria', idCategoria);
            }

            const { data: documentos, error } = await query;

            if (error) {
                await logError(req, error, 'PatientController', 'listarDocumentos', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener documentos." });
            }

            res.status(200).json({ documentos });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'listarDocumentos', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * GET /api/pat/:id/documents/:docId
     * Obtiene un documento específico de un paciente.
     */
    public async obtenerDocumento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) return res.status(401).json({ message: "No autorizado" });

            const { id, docId } = req.params;
            const idPaciente = parseInt(id as string, 10);
            const idDocumento = parseInt(docId as string, 10);
            if (isNaN(idPaciente) || isNaN(idDocumento)) return res.status(400).json({ message: "ID de paciente o documento inválido." });

            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) return res.status(404).json({ message: "Paciente no encontrado o no pertenece a este doctor." });

            const { data: documento, error } = await supabase
                .schema('clinica')
                .from('tDocumentoPaciente')
                .select('*')
                .eq('id_documento', idDocumento)
                .eq('id_paciente', idPaciente)
                .maybeSingle();

            if (error || !documento) return res.status(404).json({ message: "Documento no encontrado." });

            res.status(200).json({ documento });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'obtenerDocumento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * PUT /api/pat/:id/documents/:docId
     * Actualiza metadatos de un documento (descripción, categoría, cita).
     */
    public async actualizarDocumento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) return res.status(401).json({ message: "No autorizado" });

            const { id, docId } = req.params;
            const idPaciente = parseInt(id as string, 10);
            const idDocumento = parseInt(docId as string, 10);
            if (isNaN(idPaciente) || isNaN(idDocumento)) return res.status(400).json({ message: "ID inválido." });

            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) return res.status(404).json({ message: "Paciente no encontrado." });

            const { data: docExistente } = await supabase
                .schema('clinica')
                .from('tDocumentoPaciente')
                .select('id_documento')
                .eq('id_documento', idDocumento)
                .eq('id_paciente', idPaciente)
                .maybeSingle();
            if (!docExistente) return res.status(404).json({ message: "Documento no encontrado." });

            const { id_cita, id_categoria, descripcion } = req.body;

            const datosActualizar: any = {};
            const errores: string[] = [];

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

            if (id_categoria !== undefined) {
                if (id_categoria === null) {
                    datosActualizar.id_categoria = null;
                } else if (typeof id_categoria !== 'number' || id_categoria <= 0) {
                    errores.push("ID de categoría inválido.");
                } else {
                    const { data: categoria } = await supabase
                        .schema('clinica')
                        .from('tCategoriaDocumento')
                        .select('id_categoria')
                        .eq('id_categoria', id_categoria)
                        .maybeSingle();
                    if (!categoria) errores.push("Categoría no válida.");
                    else datosActualizar.id_categoria = id_categoria;
                }
            }

            if (descripcion !== undefined) {
                if (descripcion === null || descripcion === '') {
                    datosActualizar.descripcion = null;
                } else if (typeof descripcion === 'string') {
                    if (descripcion.trim().length > 500) errores.push("La descripción no puede exceder 500 caracteres.");
                    else datosActualizar.descripcion = descripcion.trim();
                } else {
                    errores.push("La descripción debe ser un texto.");
                }
            }

            if (errores.length > 0) return res.status(400).json({ errors: errores });
            if (Object.keys(datosActualizar).length === 0) return res.status(400).json({ message: "No se enviaron campos para actualizar." });

            const { data: actualizado, error } = await supabase
                .schema('clinica')
                .from('tDocumentoPaciente')
                .update(datosActualizar)
                .eq('id_documento', idDocumento)
                .select('*')
                .single();

            if (error) {
                await logError(req, error, 'PatientController', 'actualizarDocumento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar el documento." });
            }

            res.status(200).json({ message: "Documento actualizado exitosamente.", documento: actualizado });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'actualizarDocumento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * DELETE /api/pat/:id/documents/:docId
     * Elimina permanentemente un documento, incluyendo el archivo en Supabase Storage.
     */
    public async eliminarDocumento(req: Request, res: Response) {
        try {
            const doctorId = (req as any).user?.id_usuario;
            if (!doctorId) return res.status(401).json({ message: "No autorizado" });

            const { id, docId } = req.params;
            const idPaciente = parseInt(id as string, 10);
            const idDocumento = parseInt(docId as string, 10);
            if (isNaN(idPaciente) || isNaN(idDocumento)) return res.status(400).json({ message: "ID inválido." });

            const { data: paciente } = await supabase
                .schema('clinica')
                .from('tPaciente')
                .select('id_paciente')
                .eq('id_paciente', idPaciente)
                .eq('id_doctor', doctorId)
                .maybeSingle();
            if (!paciente) return res.status(404).json({ message: "Paciente no encontrado." });

            // Obtener el documento para conocer la ruta del archivo
            const { data: doc, error: fetchError } = await supabase
                .schema('clinica')
                .from('tDocumentoPaciente')
                .select('*')
                .eq('id_documento', idDocumento)
                .eq('id_paciente', idPaciente)
                .maybeSingle();
            if (fetchError || !doc) return res.status(404).json({ message: "Documento no encontrado." });

            // Eliminar archivo de Storage
            if (doc.ruta_almacenamiento) {
                try {
                    const url = new URL(doc.ruta_almacenamiento);
                    const pathParts = url.pathname.split('/');
                    // La URL pública es /storage/v1/object/public/<bucket>/<path>
                    const bucketIndex = pathParts.indexOf('clinica-imagenes');
                    if (bucketIndex !== -1) {
                        const filePath = pathParts.slice(bucketIndex + 1).join('/');
                        const { error: deleteStorageError } = await supabase
                            .storage
                            .from('clinica-imagenes')
                            .remove([filePath]);
                        if (deleteStorageError) {
                            console.warn('Error al eliminar archivo de Storage:', deleteStorageError.message);
                        }
                    }
                } catch {
                    console.warn('No se pudo parsear la URL del documento:', doc.ruta_almacenamiento);
                }
            }

            // Eliminar registro de BD
            const { error: deleteError } = await supabase
                .schema('clinica')
                .from('tDocumentoPaciente')
                .delete()
                .eq('id_documento', idDocumento);

            if (deleteError) {
                await logError(req, deleteError, 'PatientController', 'eliminarDocumento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al eliminar el documento." });
            }

            res.status(200).json({ message: "Documento eliminado correctamente." });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'eliminarDocumento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
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
                await logError(req, error, 'PatientController', 'obtenerHistoriaDental', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener la historia dental." });
            }

            if (!historia) {
                return res.status(404).json({ message: "Historia dental no encontrada para este paciente." });
            }

            res.status(200).json({ historia_dental: historia });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'obtenerHistoriaDental', 'clinica', 'lDoctor');
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

            // ultima_visita: fecha opcional
            if (ultima_visita !== undefined) {
                if (ultima_visita === null || ultima_visita === '') {
                    datosActualizar.ultima_visita = null;
                } else if (typeof ultima_visita === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ultima_visita)) {
                    const fecha = new Date(ultima_visita);
                    if (isNaN(fecha.getTime())) errores.push('Fecha de última visita no válida.');
                    else if (fecha > new Date()) errores.push('La última visita no puede ser futura.');
                    else datosActualizar.ultima_visita = ultima_visita;
                } else {
                    errores.push('Formato de fecha inválido para última visita (YYYY-MM-DD).');
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
                await logError(req, updateError, 'PatientController', 'actualizarHistoriaDental', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar la historia dental." });
            }

            res.status(200).json({
                message: "Historia dental actualizada exitosamente.",
                historia_dental: actualizado
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'actualizarHistoriaDental', 'clinica', 'lDoctor');
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
                await logError(req, error, 'PatientController', 'obtenerHistoriaMedica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener la historia médica." });
            }

            if (!historia) {
                return res.status(404).json({ message: "Historia médica no encontrada para este paciente." });
            }

            res.status(200).json({ historia_medica: historia });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'obtenerHistoriaMedica', 'clinica', 'lDoctor');
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
                await logError(req, updateError, 'PatientController', 'actualizarHistoriaMedica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar la historia médica." });
            }

            res.status(200).json({
                message: "Historia médica actualizada exitosamente.",
                historia_medica: actualizado
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'actualizarHistoriaMedica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
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
                await logError(req, insertError, 'PatientController', 'crearNotaClinica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al crear la nota clínica." });
            }

            res.status(201).json({
                message: "Nota clínica creada exitosamente.",
                nota_clinica: nuevaNota
            });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'crearNotaClinica', 'clinica', 'lDoctor');
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
                await logError(req, error, 'PatientController', 'listarNotasClinicas', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener notas clínicas." });
            }

            res.status(200).json({ notas_clinicas: notas });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'listarNotasClinicas', 'clinica', 'lDoctor');
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
            await logError(req, err, 'PatientController', 'obtenerNotaClinica', 'clinica', 'lDoctor');
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
                await logError(req, updateError, 'PatientController', 'actualizarNotaClinica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar la nota clínica." });
            }

            res.status(200).json({ message: "Nota clínica actualizada exitosamente.", nota_clinica: actualizada });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'actualizarNotaClinica', 'clinica', 'lDoctor');
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
                await logError(req, error, 'PatientController', 'eliminarNotaClinica', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al eliminar la nota clínica." });
            }

            res.status(200).json({ message: "Nota clínica eliminada correctamente." });

        } catch (err: any) {
            await logError(req, err, 'PatientController', 'eliminarNotaClinica', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

}

export const patientController = new PatientController();