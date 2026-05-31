/**
 * Genera un código numérico aleatorio de 6 dígitos.
 * @returns string de 6 dígitos (ej. '123456')
 */
export function generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateSixDigitCodeAsync(): Promise<string> {
    return generateSixDigitCode();
}