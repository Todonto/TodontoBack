# Flujo de Autenticación

## Base URL
/api/auth

---

## Headers Generales

### Para endpoints POST con JSON
Content-Type: application/json

### Para endpoints protegidos
Authorization: Bearer {access_token}

---

## Endpoints Disponibles

### 1. Registro de Usuario

Endpoint: POST /register

Headers: Content-Type: application/json

Body:
{
  "nombre_usuario": "José Armando",
  "apellido_paterno": "Ruano",
  "apellido_materno": "Mascorro",
  "correo_electronico": "armando.dev@gmail.com",
  "numero_telefono": "4681234567",
  "fecha_nacimiento": "2005-01-18",
  "sexo_usuario": "M",
  "contrasena": "Password123!",
  "acepta_aviso_privacidad": true,
  "acepta_terminos_condiciones": true
}

Validaciones:
- Nombre entre 3 y 50 caracteres
- Apellido paterno entre 5 y 50 caracteres
- Email válido
- Teléfono de 10 a 13 dígitos
- Mayor de edad (18+)
- Contraseña segura: mayúscula, minúscula, número, carácter especial, sin espacios, mínimo 8 caracteres

Respuesta Esperada (201):
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": 1,
    "nombre_usuario": "José Armando",
    "correo_electronico": "armando.dev@gmail.com"
  },
  "next_step": "verify-email"
}

Flujo Frontend:
1. Mostrar mensaje de éxito
2. Redirigir a pantalla de verificar correo

---

### 2. Enviar Código de Verificación

Endpoint: POST /send-verification-code

Headers: Content-Type: application/json

Body:
{
  "correo": "armando.dev@gmail.com"
}

Respuesta Esperada (200):
{
  "message": "Código de verificación enviado. Revisa tu correo."
}

Uso Frontend: Botón "Enviar código" o "Reenviar código"

---

### 3. Verificar Correo

Endpoint: POST /verify-email

Headers: Content-Type: application/json

Body:
{
  "correo": "armando.dev@gmail.com",
  "codigo": "123456"
}

Respuesta Esperada (200):
{
  "message": "Correo verificado exitosamente",
  "user": {
    "id": 1,
    "nombre_usuario": "José Armando",
    "correo_electronico": "armando.dev@gmail.com",
    "correo_verificado": true
  },
  "tokens": {
    "access_token": "...",
    "expires_in": "15m"
  }
}

Flujo Frontend:
1. Guardar tokens (access_token en memoria/sessionStorage, refresh_token en HttpOnly Cookie)
2. Redirigir al dashboard

---

### 4. Login

Endpoint: POST /login

Headers: Content-Type: application/json

Body:
{
  "correo": "armando.dev@gmail.com",
  "contrasena": "Password123!"
}

Respuesta Esperada (200):
{
  "message": "Inicio de sesión exitoso",
  "user": {
    "id": 1,
    "nombre_usuario": "José Armando",
    "correo_electronico": "armando.dev@gmail.com",
    "suscripcion": null
  },
  "tokens": {
    "access_token": "...",
    "expires_in": "15m"
  }
}

Posibles Errores:
- 401: Credenciales inválidas (contraseña incorrecta)
- 403: Correo no verificado
- 423: Cuenta bloqueada por intentos fallidos (15 min)

Seguridad:
- 5 intentos fallidos = bloqueo de 15 minutos
- Máximo 3 sesiones activas simultáneas
- Alerta de seguridad enviada por correo al iniciar sesión

---

### 5. Solicitar Recuperación de Contraseña

Endpoint: POST /send-password-reset-code

Headers: Content-Type: application/json

Body:
{
  "correo": "armando.dev@gmail.com"
}

Respuesta Esperada (200):
{
  "message": "Si el correo está registrado, recibirás un código para restablecer tu contraseña"
}

Nota: Por seguridad, el mensaje es el mismo aunque el correo no exista en la BD

---

### 6. Verificar Código de Recuperación

Endpoint: POST /verify-password-code

Headers: Content-Type: application/json

Body:
{
  "correo": "armando.dev@gmail.com",
  "codigo": "123456"
}

Respuesta Esperada (200):
{
  "message": "Código verificado correctamente",
  "reset_token": "...",
  "expires_in": "10 minutos"
}

Nota: El reset_token expira en 10 minutos

---

### 7. Cambiar Contraseña

Endpoint: POST /reset-password

Headers: Content-Type: application/json

Body:
{
  "reset_token": "...",
  "nueva_contrasena": "NuevaPass123!"
}

Validaciones:
- Mínimo 8 caracteres
- Máximo 70 caracteres
- Al menos una mayúscula
- Al menos una minúscula
- Al menos un número
- Al menos un carácter especial
- Sin espacios

Respuesta Esperada (200):
{
  "message": "Contraseña actualizada exitosamente. Por seguridad, todas las sesiones han sido cerradas."
}

Consecuencias:
- Actualiza la contraseña
- Cierra TODAS las sesiones activas
- Envía correo de confirmación del cambio

---

### 8. Renovar Token (Refresh Token)

Endpoint: POST /refresh-token

Headers: Content-Type: application/json

Body:
{
  "refresh_token": "..."
}

Respuesta Esperada (200):
{
  "message": "Token refrescado exitosamente",
  "tokens": {
    "access_token": "...",
    "expires_in": "15m"
  }
}

Seguridad:
- Refresh Token Rotativo: se revoca el anterior y se genera uno nuevo
- Si se detecta un token ya revocado (posible robo): se invalida la sesión
- Se guarda IP y User-Agent de cada sesión

Flujo Frontend:
1. Detectar error 401 en una petición
2. Llamar a POST /refresh-token con el refresh_token almacenado
3. Guardar los nuevos tokens
4. Reintentar la petición original

---

## Flujo Completo en Frontend

### Registro de Nuevo Usuario
1. POST /register → Obtener next_step: "verify-email"
2. POST /send-verification-code → Enviar código al correo
3. POST /verify-email → Obtener tokens
4. Guardar tokens (access_token en memoria, refresh_token en cookie segura)
5. Redirigir al dashboard

### Usuario Existente (Login)
1. POST /login → Obtener tokens + datos de usuario
2. Guardar tokens
3. Consumir APIs protegidas con Authorization: Bearer {access_token}

### Token Expirado
1. Recibir error 401 de cualquier endpoint protegido
2. POST /refresh-token con el refresh_token guardado
3. Guardar nuevos tokens
4. Reintentar la petición original

### Recuperación de Contraseña
1. POST /send-password-reset-code → Solicitar código
2. POST /verify-password-code → Obtener reset_token
3. POST /reset-password → Cambiar contraseña
4. Redirigir al login (todas las sesiones fueron cerradas)

---

## Seguridad Implementada

- bcrypt hash de contraseñas (salt rounds: 12 en producción, 10 en desarrollo)
- JWT access token con tiempo de expiración configurable
- Refresh token almacenado como hash en base de datos
- Refresh token rotativo (se revoca al usar)
- Máximo 3 sesiones activas por usuario (las más antiguas se revocan automáticamente)
- Bloqueo de cuenta tras 5 intentos fallidos de login (15 minutos)
- Rate limiting por endpoint:
  - Registro: 5 intentos cada 15 minutos
  - Login: 10 intentos cada 10 minutos
  - Envío de código de verificación: 3 intentos cada 15 minutos
  - Verificación de email: 10 intentos cada 15 minutos
  - Solicitud de reset de contraseña: 3 intentos cada 60 minutos
  - Verificación de código de recuperación: 10 intentos cada 15 minutos
  - Cambio de contraseña: 3 intentos cada 60 minutos
  - Refresh token: 30 intentos cada 15 minutos
- Alertas de seguridad por correo electrónico al iniciar sesión
- Invalidación de todas las sesiones al cambiar contraseña
- Códigos de verificación de un solo uso con expiración de 10 minutos
- Correos de bienvenida y confirmación de cambio de contraseña

---

## Notas para Frontend

### Almacenamiento de Tokens (Recomendado)
- access_token: en memoria (variable) o sessionStorage. NUNCA en localStorage
- refresh_token: en HttpOnly Cookie (ideal). Si no es posible, usar sessionStorage con precauciones adicionales

### Consumo de APIs Protegidas
Incluir en cada petición:
Authorization: Bearer {access_token}

### Manejo de Errores Comunes
- 400: Datos inválidos (revisar validaciones)
- 401: Token expirado o credenciales inválidas (usar refresh token o redirigir a login)
- 403: Correo no verificado (redirigir a verificar correo)
- 409: Correo o teléfono ya registrado
- 423: Cuenta bloqueada (mostrar tiempo restante de bloqueo)
- 429: Demasiadas peticiones (esperar antes de reintentar)

---

## Estructura del Código

### authRoutes.ts
Define todas las rutas y aplica rate limits específicos:
- POST /register → registerLimiter → authController.register
- POST /login → loginLimiter → authController.login
- POST /send-verification-code → sendVerificationLimiter → authController.sendVerificationCode
- POST /verify-email → verifyEmailLimiter → authController.verifyEmail
- POST /send-password-reset-code → passwordResetLimiter → authController.sendChangePasswordCode
- POST /verify-password-code → verifyPasswordCodeLimiter → authController.verifyPasswordCode
- POST /reset-password → resetPasswordLimiter → authController.resetPassword
- POST /refresh-token → refreshTokenLimiter → authController.refreshToken

### authController.ts
Métodos principales:
- register(): Validación y creación de usuario nuevo
- sendVerificationCode(): Genera y envía código OTP de 6 dígitos
- verifyEmail(): Valida código y activa la cuenta, genera tokens de sesión
- login(): Autentica credenciales, gestiona sesiones y bloqueos
- sendChangePasswordCode(): Inicia flujo de recuperación de contraseña
- verifyPasswordCode(): Valida código y genera reset_token temporal
- resetPassword(): Cambia contraseña e invalida todas las sesiones
- refreshToken(): Rota el refresh token y emite nuevos JWT
- registrarIntentoFallido(): Helper privado para bloqueo por intentos