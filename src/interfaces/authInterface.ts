export interface RegisterUser {
    nombre_usuario: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    correo_electronico: string;
    numero_telefono: string;
    fecha_nacimiento?: Date;
    sexo_usuario?: 'M' | 'F' | 'O';
    contrasena: string;
    id_rol_usuario?: number;
    acepta_aviso_privacidad: boolean;
    acepta_terminos_condiciones: boolean;
}

export interface UsuarioDB extends Omit<RegisterUser, 'contrasena'> {
    contrasena_hash: string;
}

export interface LoginCredentials {
    correo: string;
    contrasena: string;
}