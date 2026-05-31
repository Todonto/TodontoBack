import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

// Secretos separados
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// Tiempos de expiración
const ACCESS_EXPIRES: jwt.SignOptions["expiresIn"] = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as jwt.SignOptions["expiresIn"];
const REFRESH_EXPIRES_SECONDS = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800'); // 7 días en segundos

// Interfaz del Token
export interface TokenPayload {
    id_usuario: number;
    nombre_usuario: string;
    correo_electronico: string;
    id_rol_usuario: number;
}

/**
 * Genera un access token (vida corta)
 */
export function generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
        payload as object,
        JWT_ACCESS_SECRET,
        {
            expiresIn: ACCESS_EXPIRES
        } as jwt.SignOptions
    );
}

/**
 * Genera un refresh token (vida larga)
 */
export function generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(
        payload as object,
        JWT_REFRESH_SECRET,
        {
            expiresIn: REFRESH_EXPIRES_SECONDS
        } as jwt.SignOptions
    );
}

/**
 * Hashea un refresh token para almacenarlo en BD
 */
export async function hashRefreshToken(refreshToken: string): Promise<string> {
    return await bcrypt.hash(refreshToken, 10);
}

/**
 * Verifica un access token (usado en authMiddleware)
 */
export function verifyAccessToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
}

/**
 * Verifica un refresh token (usado en refreshToken)
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
}

/**
 * Alias para compatibilidad
 * @deprecated Usar verifyAccessToken directamente
 */
export function verifyToken(token: string): TokenPayload | null {
    return verifyAccessToken(token);
}

/**
 * Devuelve la fecha de expiración para un nuevo refresh token
 */
export function getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000);
}
