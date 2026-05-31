import supabase from "../database";
import { Request } from "express";

export async function logError(
    req: Request,
    error: any,
    clase: string,
    metodo: string,
    schema: string,
    table: string,
    id_usuario?: number
) {
    try {
        await supabase.schema(schema).from(table).insert({
            id_usuario: id_usuario || null,
            mensaje_error: error.message || 'Error desconocido',
            detalle_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            clase,
            metodo,
            ip_address: req.ip || req.socket.remoteAddress,
            user_agent: req.headers['user-agent']
        });
    } catch (logErr) {
        console.error('Error al guardar log:', logErr);
    }
}