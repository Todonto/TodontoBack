# Flujo de Doctores (Configuración y Tratamientos)

## Base URL
/api/doc

---

## Headers Generales

### Para endpoints POST/PUT con JSON
Content-Type: application/json

### Para endpoints protegidos
Authorization: Bearer {access_token}

### Para subida de logo (multipart/form-data)
Content-Type: multipart/form-data

---

## Endpoints Disponibles

### 1. Configurar Consultorio

**Endpoint:** POST /configure

**Headers:** Authorization: Bearer {access_token}
**Content-Type:** multipart/form-data

**Campos (form-data):**

| Campo                  | Tipo   | Obligatorio | Descripción |
|------------------------|--------|-------------|-------------|
| diasActivos            | text   | Sí          | Array JSON de días (0=Dom, 1=Lun, ..., 6=Sáb) |
| horaApertura           | text   | Sí          | Hora de inicio HH:MM (24h) |
| horaCierre             | text   | Sí          | Hora de fin HH:MM (24h) |
| margenFin              | text   | No          | Minutos de margen al final del bloque (0-120) |
| notacion_odontograma   | text   | No          | FDI, UNIVERSAL, PALMER, HADERUP (default: FDI) |
| tratamientos           | text   | No          | Array JSON de objetos con: nombre, duracion_minutos, codigo, descripcion, costo_sugerido, color, requiere_odontograma |
| logo                   | File   | No          | Imagen (JPG, PNG, SVG, WEBP) máx 2 MB |

**Ejemplo de body (form-data):**

diasActivos = [1,2,3,4,5]
horaApertura = 09:00
horaCierre = 18:00
margenFin = 30
notacion_odontograma = FDI
tratamientos = [{"nombre":"Limpieza dental","duracion_minutos":45,"costo_sugerido":500,"color":"#378ADD","codigo":"LIMP","requiere_odontograma":false}]
logo = [archivo]

**Validaciones:**
- diasActivos: Array de números enteros entre 0 y 6, al menos un día
- horaApertura y horaCierre: Formato HH:MM de 24 horas, apertura < cierre
- margenFin: Número entero entre 0 y 120 (minutos)
- notacion_odontograma: Uno de los valores permitidos, si se envía
- Cada tratamiento en el array:
  - nombre: Texto obligatorio, máximo 50 caracteres
  - duracion_minutos: Número positivo obligatorio
  - costo_sugerido: Número >=0 (opcional)
  - color: Hexadecimal #RRGGBB válido (opcional)
  - codigo: Texto opcional, si no se envía se genera automáticamente
  - requiere_odontograma: Booleano (opcional)
- El logo debe ser una imagen de los formatos permitidos y no exceder 2 MB

**Comportamiento:**
- Reemplaza todos los horarios anteriores del doctor
- Reemplaza todos los tratamientos anteriores del doctor
- Si se sube logo, lo almacena en Supabase Storage y guarda la URL en tUsuario.logo
- La notación de odontograma se actualiza en el perfil del doctor

**Respuesta Esperada (200):**
{
  "message": "Configuración guardada exitosamente",
  "logo_url": "https://.../logos/logo_5_a1b2c3.png",
  "horarios_guardados": 5,
  "tratamientos_guardados": 1
}

**Posibles Errores:**
- 400: Errores de validación (mensaje descriptivo)
- 401: No autorizado
- 500: Error interno

---

### 2. Obtener Configuración

**Endpoint:** GET /configure

**Headers:** Authorization: Bearer {access_token}

**Respuesta Esperada (200):**
{
  "logo_url": "https://...",
  "notacion_odontograma": "FDI",
  "horarios": [
    {
      "dia_semana": 1,
      "hora_inicio": "09:00:00",
      "hora_fin": "18:00:00",
      "margen_fin_minutos": 30,
      "activo": true
    }
    // ... uno por cada día configurado
  ],
  "tratamientos": [
    {
      "id_tratamiento": 1,
      "codigo": "LIMP",
      "nombre": "Limpieza dental",
      "duracion_minutos": 45,
      "costo_sugerido": 500.00,
      "color": "#378ADD",
      "activo": true,
      "requiere_odontograma": false
    }
    // ... todos los tratamientos del doctor
  ]
}

**Nota:** Si no se ha configurado, logo_url será null y los arrays estarán vacíos.

---

### 3. Crear Tratamiento

**Endpoint:** POST /treatments

**Headers:** Content-Type: application/json | Authorization: Bearer {access_token}

**Body:**
{
  "nombre": "Limpieza dental",
  "duracion_minutos": 45,
  "costo_sugerido": 500,
  "color": "#378ADD",
  "codigo": "LIMP",
  "descripcion": "Limpieza básica con ultrasonido",
  "requiere_odontograma": false
}

**Campos obligatorios:** nombre, duracion_minutos.
**Campos opcionales:** codigo (si no se envía se genera uno automáticamente), descripcion, costo_sugerido, color, requiere_odontograma.

**Validaciones:**
- nombre: 1-50 caracteres, obligatorio
- duracion_minutos: Número positivo obligatorio
- costo_sugerido: Número >=0 (opcional)
- color: Hexadecimal válido #RRGGBB (opcional)
- codigo: 1-50 caracteres (opcional, si no se envía se genera a partir del nombre)
- requiere_odontograma: Booleano (opcional, default false)

**Respuesta Esperada (201):**
{
  "message": "Tratamiento creado exitosamente.",
  "tratamiento": { ... }
}

**Posibles Errores:**
- 400: Errores de validación (array 'errors')
- 409: Ya existe un tratamiento con ese código para este doctor
- 401: No autorizado
- 500: Error interno

---

### 4. Listar Tratamientos

**Endpoint:** GET /treatments

**Headers:** Authorization: Bearer {access_token}

**Query Params opcionales:**
- activo: true|false (filtra por estado)

**Ejemplos:**
GET /api/doc/treatments
GET /api/doc/treatments?activo=true

**Respuesta Esperada (200):**
{
  "tratamientos": [ ... ]
}

---

### 5. Obtener Tratamiento por ID

**Endpoint:** GET /treatments/:id

**Headers:** Authorization: Bearer {access_token}

**Respuesta Esperada (200):**
{
  "tratamiento": { ... }
}

**Errores:**
- 404: Tratamiento no encontrado o no pertenece a este doctor
- 400: ID inválido

---

### 6. Actualizar Tratamiento

**Endpoint:** PUT /treatments/:id

**Headers:** Content-Type: application/json | Authorization: Bearer {access_token}

**Body (parcial, solo campos a actualizar):**
{
  "nombre": "Limpieza profunda",
  "duracion_minutos": 60,
  "costo_sugerido": 800
}

**Validaciones:** Igual que en creación, pero solo se aplican a los campos enviados. Se puede enviar null para limpiar campos opcionales.

**Respuesta Esperada (200):**
{
  "message": "Tratamiento actualizado exitosamente.",
  "tratamiento": { ... }
}

**Posibles Errores:**
- 400: Errores de validación o sin campos enviados
- 404: Tratamiento no encontrado o no pertenece a este doctor
- 409: Código duplicado para este doctor

---

### 7. Desactivar Tratamiento (Soft Delete)

**Endpoint:** DELETE /treatments/:id

**Headers:** Authorization: Bearer {access_token}

**Respuesta Esperada (200):**
{
  "message": "Tratamiento desactivado correctamente."
}

**Nota:** El tratamiento queda con activo=false. No se elimina físicamente para preservar referencias en citas y tratamientos realizados.

**Errores:**
- 400: Tratamiento ya desactivado
- 404: No encontrado

---

## Flujo Completo en Frontend (Doctores)

### Configuración inicial del consultorio
1. GET /configure → Verificar si ya hay configuración previa
2. POST /configure con días, horarios, logo y tratamientos iniciales
3. Mostrar resumen de lo guardado

### Gestión de tratamientos
1. GET /treatments?activo=true → Listar solo activos en la UI
2. POST /treatments → Agregar uno nuevo
3. PUT /treatments/:id → Editar nombre, duración, precio, color
4. DELETE /treatments/:id → Desactivar (soft delete)
5. GET /treatments?activo=false → Ver inactivos si se necesita restaurar

---

## Estructura del Código

### DoctorRoutes.ts
Define todas las rutas y aplica el middleware de autenticación:
- POST /configure → authMiddleware → doctorController.configurarConsultorio
- GET /configure → authMiddleware → doctorController.obtenerConfiguracion
- POST /treatments → authMiddleware → doctorController.crearTratamiento
- GET /treatments → authMiddleware → doctorController.listarTratamientos
- GET /treatments/:id → authMiddleware → doctorController.obtenerTratamiento
- PUT /treatments/:id → authMiddleware → doctorController.actualizarTratamiento
- DELETE /treatments/:id → authMiddleware → doctorController.eliminarTratamiento

### DoctorController.ts
**Métodos principales:**
- configurarConsultorio(): Recibe logo, horarios y tratamientos; actualiza todo el consultorio
- obtenerConfiguracion(): Devuelve logo, notación, horarios y tratamientos actuales
- crearTratamiento(): Crea un nuevo tratamiento para el doctor autenticado
- listarTratamientos(): Lista tratamientos con filtro opcional por estado
- obtenerTratamiento(): Obtiene un tratamiento específico
- actualizarTratamiento(): Actualiza parcialmente un tratamiento
- eliminarTratamiento(): Desactiva (soft delete) un tratamiento