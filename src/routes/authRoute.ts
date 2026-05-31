import { Router } from "express";
import { authController } from "../controllers/authController";
import rateLimit from "express-rate-limit";

const createLimiter = (minutes: number, max: number, message: string) =>
    rateLimit({
        windowMs: minutes * 60 * 1000,
        max,
        message: {
            message
        },
        standardHeaders: true,
        legacyHeaders: false
    });

// Registro
const registerLimiter = createLimiter(15, 20,
    "Demasiados intentos de registro. Intenta más tarde."
);

// Login
const loginLimiter = createLimiter(10, 30,
    "Demasiados intentos de inicio de sesión. Intenta más tarde."
);

// Enviar código de verificación de correo
const sendVerificationLimiter = createLimiter(15, 30,
    "Demasiados envíos de código de verificación. Intenta más tarde."
);

// Verificar código de correo
const verifyEmailLimiter = createLimiter(15, 30,
    "Demasiados intentos de verificación. Intenta más tarde."
);

// Solicitar restablecimiento de contraseña
const passwordResetLimiter = createLimiter(60, 30,
    "Demasiadas solicitudes de restablecimiento. Intenta más tarde."
);

// Validar código de recuperación
const verifyPasswordCodeLimiter = createLimiter(15, 30,
    "Demasiados intentos de validación de código. Intenta más tarde."
);

// Resetear contraseña
const resetPasswordLimiter = createLimiter(60, 30,
    "Demasiados cambios de contraseña. Intenta más tarde."
);

// Refresh token
const refreshTokenLimiter = createLimiter(15,30,
    "Demasiadas solicitudes de sesión. Intenta más tarde."
);

class AuthRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post("/register", registerLimiter, authController.register);
        this.router.post("/login", loginLimiter, authController.login);
        this.router.post("/send-verification-code", sendVerificationLimiter, authController.sendVerificationCode);
        this.router.post("/verify-email", verifyEmailLimiter, authController.verifyEmail );
        this.router.post("/send-password-reset-code", passwordResetLimiter, authController.sendChangePasswordCode);
        this.router.post("/verify-password-code", verifyPasswordCodeLimiter, authController.verifyPasswordCode);
        this.router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);
        this.router.post("/refresh-token", refreshTokenLimiter, authController.refreshToken);
    }
}

const authRoutes = new AuthRoutes();
export default authRoutes.router;