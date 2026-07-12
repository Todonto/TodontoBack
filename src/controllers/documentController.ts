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

class DocumentController {

    constructor() {
        this.subirDocumentos = this.subirDocumentos.bind(this);
        this.listarDocumentos = this.listarDocumentos.bind(this);
        this.obtenerDocumento = this.obtenerDocumento.bind(this);
        this.actualizarDocumento = this.actualizarDocumento.bind(this);
        this.eliminarDocumento = this.eliminarDocumento.bind(this);
        this.reemplazarArchivo = this.reemplazarArchivo.bind(this);
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
                await logError(req, err, 'DocumentController', 'subirDocumentos | upload', 'clinica', 'lDoctor');
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
                        await logError(req, uploadError, 'DocumentController', 'subirDocumentos | upload', 'clinica', 'lDoctor', doctorId);
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
                        await logError(req, insertError, 'DocumentController', 'subirDocumentos | insert', 'clinica', 'lDoctor', doctorId);
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
                await logError(req, error, 'DocumentController', 'subirDocumentos', 'clinica', 'lDoctor');
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
                await logError(req, error, 'DocumentController', 'listarDocumentos', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al obtener documentos." });
            }

            res.status(200).json({ documentos });

        } catch (err: any) {
            await logError(req, err, 'DocumentController', 'listarDocumentos', 'clinica', 'lDoctor');
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
            await logError(req, err, 'DocumentController', 'obtenerDocumento', 'clinica', 'lDoctor');
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
                await logError(req, error, 'DocumentController', 'actualizarDocumento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al actualizar el documento." });
            }

            res.status(200).json({ message: "Documento actualizado exitosamente.", documento: actualizado });

        } catch (err: any) {
            await logError(req, err, 'DocumentController', 'actualizarDocumento', 'clinica', 'lDoctor');
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
                await logError(req, deleteError, 'DocumentController', 'eliminarDocumento', 'clinica', 'lDoctor', doctorId);
                return res.status(500).json({ message: "Error al eliminar el documento." });
            }

            res.status(200).json({ message: "Documento eliminado correctamente." });

        } catch (err: any) {
            await logError(req, err, 'DocumentController', 'eliminarDocumento', 'clinica', 'lDoctor');
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }

    /**
     * PUT /api/pat/:id/documents/:docId
     * Reemplaza un archivo de documento de paciente.
     * Se elimina el archivo anterior y se sube el nuevo.
     */
    public reemplazarArchivo(req: Request, res: Response) {
        const uploadSingle = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                const allowed = /\.(jpg|jpeg|png|svg|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;
                if (!allowed.test(path.extname(file.originalname))) {
                    return cb(new Error("Formato de archivo no permitido"));
                }
                cb(null, true);
            }
        }).single("file");

        uploadSingle(req, res, async (err) => {
            if (err) return res.status(400).json({ message: err.message });

            try {
                const doctorId = (req as any).user?.id_usuario;
                if (!doctorId) return res.status(401).json({ message: "No autorizado" });

                const { id, docId } = req.params;
                const idPaciente = parseInt(id as string, 10);
                const idDocumento = parseInt(docId as string, 10);
                if (isNaN(idPaciente) || isNaN(idDocumento)) return res.status(400).json({ message: "ID inválido." });

                // Verificar pertenencia (paciente y documento)
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
                    .select('*')
                    .eq('id_documento', idDocumento)
                    .eq('id_paciente', idPaciente)
                    .maybeSingle();
                if (!docExistente) return res.status(404).json({ message: "Documento no encontrado." });

                if (!req.file) return res.status(400).json({ message: "Debe enviar un archivo." });

                // Eliminar archivo anterior si existe
                if (docExistente.ruta_almacenamiento) {
                    try {
                        const url = new URL(docExistente.ruta_almacenamiento);
                        const pathParts = url.pathname.split('/');
                        const bucketIndex = pathParts.indexOf('clinica-imagenes');
                        if (bucketIndex !== -1) {
                            const oldPath = pathParts.slice(bucketIndex + 1).join('/');
                            await supabase.storage.from('clinica-imagenes').remove([oldPath]);
                        }
                    } catch (e) {
                        await logError(req, e, 'DocumentController', 'reemplazarArchivo | eliminarArchivo', 'clinica', 'lDoctor', doctorId)
                    }
                }

                // Subir nuevo archivo
                const file = req.file;
                const fileExt = path.extname(file.originalname);
                const fileName = `doc_${doctorId}_${idPaciente}_${randomBytes(6).toString('hex')}${fileExt}`;
                const filePath = `documentos/${fileName}`;

                const { error: uploadError } = await supabase.storage.from('clinica-imagenes')
                    .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
                if (uploadError) {
                    await logError(req, uploadError, 'DocumentController', 'reemplazarArchivo', 'clinica', 'lDoctor', doctorId);
                    return res.status(500).json({ message: "Error al subir el nuevo archivo." });
                }

                const { data: urlData } = supabase.storage.from('clinica-imagenes').getPublicUrl(filePath);
                const publicUrl = urlData?.publicUrl || null;

                const { data: actualizado, error: updateError } = await supabase
                    .schema('clinica')
                    .from('tDocumentoPaciente')
                    .update({
                        nombre_archivo: file.originalname,
                        ruta_almacenamiento: publicUrl,
                        mime_type: file.mimetype,
                        tamanio_bytes: file.size
                    })
                    .eq('id_documento', idDocumento)
                    .select('*')
                    .single();

                if (updateError) {
                    await logError(req, updateError, 'DocumentController', 'reemplazarArchivo', 'clinica', 'lDoctor', doctorId);
                    return res.status(500).json({ message: "Error al actualizar el documento." });
                }

                res.status(200).json({ message: "Archivo reemplazado exitosamente.", documento: actualizado });

            } catch (error: any) {
                await logError(req, error, 'DocumentController', 'reemplazarArchivo', 'clinica', 'lDoctor');
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });
    }
}

export const documentController = new DocumentController();