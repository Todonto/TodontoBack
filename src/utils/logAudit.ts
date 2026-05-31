import supabase from "../database";
import { Request } from "express";
import { logError } from "./logError";

export async function logAudit(
    req: Request,
    accion: string,
    entidad: string,
    entidad_id: number | null,
    detalles: object | null,
    id_usuario?: number
) {
    try {
        await supabase.schema('auditoria').from('tAuditoria').insert({
            id_usuario: id_usuario || entidad_id, // para registro, el id del nuevo usuario
            accion,
            entidad,
            entidad_id,
            detalles: detalles || {},
            ip_address: req.ip || req.socket.remoteAddress,
            user_agent: req.headers['user-agent']
        });
    } catch (err) {
        await logError(req, err, 'logAudit', 'insertar-auditoria', 'sistema', 'lSistema', id_usuario || 0);
    }
}