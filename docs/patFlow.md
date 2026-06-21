# Flujo de Pacientes

## Base URL
/api/pat

---

## Headers Generales

### Para endpoints POST/PUT con JSON
Content-Type: application/json

### Para endpoints protegidos
Authorization: Bearer {access_token}

### Para subida de documentos (multipart/form-data)
Content-Type: multipart/form-data

---

## Endpoints Disponibles

### 1. Crear Paciente

**Endpoint:** POST /

**Headers:** Content-Type: application/json | Authorization: Bearer {access_token}

**Body:**
{
  "nombre": "María García",
  "telefono_principal": "4771234567",
  "apellido_paterno": "García",
  "apellido_materno": "López",
  "fecha_nacimiento": "1990-05-15",
  "sexo": "M",
  "correo_electronico": "maria@example.com",
  "telefono_secundario": "4770000000",
  "calle": "Av. Siempre Viva",
  "numero_exterior": "123",
  "numero_interior": "A",
  "colonia": "Centro",
  "ciudad": "León",
  "estado": "Guanajuato",
  "codigo_postal": "37000",
  "pais": "México",
  "contacto_emergencia_nombre": "Juan García",
  "contacto_emergencia_parentesco": "Padre",
  "contacto_emergencia_telefono": "4779876543",
  "ocupacion": "Ingeniero",
  "referido_por": "Dr. Martínez"
}

**Campos obligatorios:**
- nombre (2-60 caracteres, solo letras y espacios)
- telefono_principal (10-15 dígitos, permite formato internacional con +)

**Validaciones adicionales (campos opcionales):**
- Apellidos: 2-60 caracteres, solo letras
- Fecha de nacimiento: formato YYYY-MM-DD, mayor de 18 años, no futura
- Sexo: M, F, O
- Correo: formato válido, máx 150 caracteres
- Teléfonos secundario/emergencia: 10-15 dígitos
- Dirección y otros textos: se rechazan emojis, caracteres de control y símbolos no permitidos según el tipo de campo

**Respuesta Esperada (201):**
{
  "message": "Paciente creado exitosamente.",
  "paciente": {
    "id_paciente": 1,
    "nombre": "María García",
    "telefono_principal": "4771234567",
    ... (todos los campos)
  }
}

**Posibles Errores:**
- 400: Errores de validación (array 'errors')
- 401: No autorizado
- 500: Error interno

---

### 2. Listar Pacientes

**Endpoint:** GET /

**Headers:** Authorization: Bearer {access_token}

**Query Params opcionales:**
- activo: true|false (filtra por estado)
- buscar: texto (busca en nombre, apellidos, teléfono)

**Ejemplos:**
GET /api/pat?activo=true
GET /api/pat?buscar=María

**Respuesta Esperada (200):**
{
  "pacientes": [ ... ]
}

---

### 3. Obtener Paciente por ID

**Endpoint:** GET /:id

**Headers:** Authorization: Bearer {access_token}

**Respuesta Esperada (200):**
{
  "paciente": { ... }
}

**Errores:**
- 404: Paciente no encontrado o no pertenece al doctor
- 400: ID inválido

---

### 4. Actualizar Paciente

**Endpoint:** PUT /:id

**Headers:** Content-Type: application/json | Authorization: Bearer {access_token}

**Body (parcial, solo campos a actualizar):**
{
  "nombre": "María Guadalupe",
  "colonia": "Nueva Colonia"
}

**Validaciones:** Igual que en creación, pero solo se aplican a los campos enviados. Se puede enviar null para limpiar campos opcionales.

**Respuesta Esperada (200):**
{
  "message": "Paciente actualizado exitosamente.",
  "paciente": { ... }
}

---

### 5. Desactivar Paciente (Soft Delete)

**Endpoint:** DELETE /:id

**Headers:** Authorization: Bearer {access_token}

**Respuesta Esperada (200):**
{
  "message": "Paciente desactivado correctamente."
}

**Nota:** El paciente queda con activo=false y conserva todas sus relaciones (citas, documentos). No se elimina físicamente.

**Errores:**
- 400: Paciente ya desactivado
- 404: No encontrado

---

### 6. Crear Cita

**Endpoint:** POST /appointments

**Headers:** Content-Type: application/json | Authorization: Bearer {access_token}

**Body (con paciente existente):**
{
  "fecha_hora_inicio": "2026-06-25T09:00:00",
  "fecha_hora_fin": "2026-06-25T09:45:00",
  "id_paciente": 1,
  "id_tratamiento": 1,
  "tipo_cita": "revision"
}

**Body (con nuevo paciente):**
{
  "fecha_hora_inicio": "2026-06-25T10:00:00",
  "fecha_hora_fin": "2026-06-25T10:30:00",
  "nombre_nuevo": "Ana López",
  "telefono_principal_nuevo": "4779876543",
  "tipo_cita": "primera_vez"
}

**Validaciones:**
- Fechas obligatorias en formato ISO 8601, inicio < fin
- Estado debe ser uno de: programada, confirmada, en_curso, completada, cancelada, no_asistio
- Si se envía id_tratamiento, debe existir y estar activo para el doctor
- Si se envía id_paciente, el paciente debe pertenecer al doctor
- Si no se envía id_paciente, se debe enviar nombre_nuevo y telefono_principal_nuevo (se crea el paciente automáticamente)

**Respuesta Esperada (201):**
{
  "message": "Cita creada exitosamente.",
  "id_cita": 1,
  "id_paciente": 2
}

**Posibles Errores:**
- 400: Error de validación o conflicto de horario laboral
- 404: Paciente inexistente
- 409: Solapamiento de citas
- 500: Error interno

---

### 7. Subir Documentos

**Endpoint:** POST /documents

**Headers:** Authorization: Bearer {access_token}
**Content-Type:** multipart/form-data

**Campos (form-data):**
- id_paciente (text, obligatorio)
- id_cita (text, opcional)
- id_categoria (text, opcional)
- descripcion (text, opcional)
- files (File, múltiples, máx 10 archivos)

**Formatos permitidos:** JPG, PNG, SVG, WEBP, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
**Tamaño máximo por archivo:** 10 MB

**Validaciones:**
- El paciente debe pertenecer al doctor
- Si se envía id_cita, la cita debe existir, pertenecer al doctor y corresponder al mismo paciente
- La categoría debe existir en tCategoriaDocumento

**Respuesta Esperada (201):**
{
  "message": "2 documento(s) subido(s) exitosamente.",
  "documentos": [ ... ]
}

---

## Flujo Completo en Frontend (Pacientes)

### Crear paciente
1. POST / → Obtener id_paciente y datos completos
2. Redirigir a la vista de detalle del paciente o a la agenda

### Agendar cita con paciente existente
1. POST /appointments con id_paciente
2. Mostrar confirmación con id_cita

### Agendar cita con nuevo paciente
1. POST /appointments sin id_paciente, con nombre y teléfono
2. Recibir id_cita e id_paciente creados

### Subir documentos a un paciente
1. Preparar FormData con campos id_paciente, id_cita, id_categoria, files
2. POST /documents
3. Mostrar lista de documentos subidos