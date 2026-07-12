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

/**
 * Valida un campo de texto contra patrones predefinidos y restricciones de longitud.
 * @param valor - El valor a validar.
 * @param campo - Nombre del campo (para mensajes de error).
 * @param tipo - Tipo de campo (debe coincidir con una clave de PATRONES).
 * @param min - Longitud mínima (0 = sin mínimo).
 * @param max - Longitud máxima.
 * @param obligatorio - Si el campo es obligatorio.
 * @returns Mensaje de error o null si es válido.
 */
export function validarTexto(
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

/**
 * Valida un número de teléfono (limpia caracteres no numéricos y verifica longitud).
 * @param valor - El valor a validar.
 * @param campo - Nombre del campo.
 * @returns Mensaje de error o null si es válido.
 */
export function validarTelefono(valor: any, campo: string): string | null {
    if (!valor) return `El campo ${campo} es obligatorio.`;
    const tel = String(valor).replace(/[^\d+]/g, '');
    if (tel.length < 10 || tel.length > 15) {
        return `El campo ${campo} debe tener entre 10 y 15 dígitos.`;
    }
    return null;
}

/**
 * Valida una fecha en formato YYYY-MM-DD, verificando que sea válida y dentro de rangos lógicos (no futura, edad <= 110).
 * @param valor - La fecha en string.
 * @param campo - Nombre del campo.
 * @returns Mensaje de error o null si es válida.
 */
export function validarFecha(valor: any, campo: string): string | null {
    if (!valor) return null; // opcional
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return `Formato de fecha inválido para ${campo} (YYYY-MM-DD).`;
    }
    const fecha = new Date(valor);
    if (isNaN(fecha.getTime())) {
        return `Fecha no válida para ${campo}.`;
    }
    const hoy = new Date();
    if (fecha > hoy) {
        return `La fecha de ${campo} no puede ser futura.`;
    }
    const edad = hoy.getFullYear() - fecha.getFullYear();
    if (edad > 110) {
        return `Edad no válida (mayor a 110 años) para ${campo}.`;
    }
    return null;
}

/**
 * Valida un campo booleano.
 * @param valor - El valor a validar.
 * @param campo - Nombre del campo.
 * @returns Mensaje de error o null si es válido.
 */
export function validarBooleano(valor: any, campo: string): string | null {
    if (typeof valor !== 'boolean') {
        return `El campo ${campo} debe ser booleano (true/false).`;
    }
    return null;
}