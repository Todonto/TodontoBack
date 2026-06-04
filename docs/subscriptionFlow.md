# Flujo de Suscripcón

## Base URL
/api/sub

---

## Iniciar webhook
Instalar ngrok para hacer la conexión con Stripe
```bash
npm install ngrok
```

Ejecutar el siguiente comando para escuchar las llamadas de Stripe
```bash
ngrok http 3000
```

## Headers Generales

### Para endpoints POST con JSON
**Content-Type:** application/json

### Para endpoints protegidos
**Authorization:** Bearer {access_token}

---

## Endpoints Disponibles

### 1. Ver planes

**Endpoint:** GET /plans

**Respuesta Esperada (201):**

```json
[
    {
        "id_tipo_suscripcion": 1,
        "nombre": "Inicio",
        "descripcion": "Acceso gratuito con funcionalidad limitada",
        "duracion_dias": null,
        "precio": 0,
        "moneda": "MXN",
        "max_pacientes": 10,
        "max_citas_mes": 5,
        "max_recetas_mes": 5,
        "requiere_metodo_pago": false,
        "es_prueba": false,
        "stripe_price_id": null,
        "activo": true
    },
    {
        "id_tipo_suscripcion": 2,
        "nombre": "Prueba",
        "descripcion": "Acceso completo por 14 días. Requiere registrar método de pago.",
        "duracion_dias": 14,
        "precio": 0,
        "moneda": "MXN",
        "max_pacientes": null,
        "max_citas_mes": null,
        "max_recetas_mes": null,
        "requiere_metodo_pago": true,
        "es_prueba": true,
        "stripe_price_id": null,
        "activo": true
    },
    {
        "id_tipo_suscripcion": 3,
        "nombre": "Profesional",
        "descripcion": "Plan mensual con acceso completo a todas las funciones",
        "duracion_dias": 30,
        "precio": 399,
        "moneda": "MXN",
        "max_pacientes": null,
        "max_citas_mes": null,
        "max_recetas_mes": null,
        "requiere_metodo_pago": true,
        "es_prueba": false,
        "stripe_price_id": "price_1TQcNCIsbtJs5QhyRhFdMG3Q",
        "activo": true
    },
    {
        "id_tipo_suscripcion": 4,
        "nombre": "Profesional Anual",
        "descripcion": "Plan anual con descuento del 25%. Equivale a $299/mes.",
        "duracion_dias": 365,
        "precio": 3588,
        "moneda": "MXN",
        "max_pacientes": null,
        "max_citas_mes": null,
        "max_recetas_mes": null,
        "requiere_metodo_pago": true,
        "es_prueba": false,
        "stripe_price_id": "price_1TQcO2IsbtJs5QhyIj9TIGXi",
        "activo": true
    }
]
```

**Flujo Frontend:**
1. Mostrar planes disponibles
2. Redirigir a la compra de suscrpición

---

### 2. Obtener prueba gratuita

**Endpoint:** POST /trial

**Headers:** Content-Type: application/json

__Crear método de pago (ver archivo src/scripts/stripePago.test.ts)__

**Body:**
```json
{
  "payment_method_id": "pm_1TT6BIIsbtJs5QhyFOuhTbOA"
}
```

**Respuesta Esperada (200):**
```json
{
    "message": "Prueba activada. Se convertirá automáticamente en plan de pago al finalizar los 14 días.",
    "subscription_id": "sub_1TeUM3IsbtJs5QhyDUIRpNnQ",
    "trial_end": 1781762530
}
```

**Posibles errores:**
Usuario ya tiene cuenta diferente a la gratuita. (500):
```json
{
    "message": "El usuario no está en el plan Inicio o ya tuvo una prueba activa"
}
```

Metodo de pago incorrecto (500):
```json
{
    "message": "No such PaymentMethod: 'hola'"
}
```

**Uso Frontend:** Crear suscripción premium en prueba de 7 días

---

### 3. Suscribirse

**Endpoint:** POST /subscribe

**Headers:** Content-Type: application/json

__Suscripción mensual: price_1TQcNCIsbtJs5QhyRhFdMG3Q__
__Suscripción anual: price_1TQcO2IsbtJs5QhyIj9TIGXi__
__Crear método de pago (ver archivo src/scripts/stripePago.test.ts)__

**Body:**
```json
{
    "price_id": "price_1TQcO2IsbtJs5QhyIj9TIGXi"
    "payment_method_id": "pm_1TeURWIsbtJs5QhyvNSOfCG9" // Opcional si ya tiene metodo de pago
}
```

**Respuesta Esperada (200):**
```json
{
    "message": "Suscripción creada. El pago se confirmará en breve.",
    "subscription_id": "sub_1TeUVxIsbtJs5QhyQgH4MoIt",
    "status": "active",
    "plan": "Profesional Anual"
}
```

**Posibles errores:**
Sin metodo de pago (400):
```json
{
    "message": "No tienes un método de pago predeterminado. Envía payment_method_id."
}
```

Suscribirse con cuenta premium activa (400):
```json
{
    "message": "Ya tienes un plan de pago activo. Usa /change-plan para actualizarlo."
}
```


**Flujo Frontend:**
Crear una suscripción premium desde una cuenta básica.

---

### 4. Cambiar plan

**Endpoint:** POST /change-plan

**Headers:** Content-Type: application/json

__Suscripción mensual: price_1TQcNCIsbtJs5QhyRhFdMG3Q__
__Suscripción anual: price_1TQcO2IsbtJs5QhyIj9TIGXi__

**Body:**
```json
{
    "new_price_id": "price_1TQcNCIsbtJs5QhyRhFdMG3Q"
}
```

**Respuesta Esperada (200):**
```json
{
    "message": "Plan actualizado exitosamente",
    "plan": "Profesional Anual",
    "nueva_fecha_fin": "2027-06-04T06:12:25.000Z"
}
```

**Posibles Errores:**
Plan inexistente (400):
```json
{
    "message": "El plan solicitado no existe."
}
```

---

### 5. Cancelar suscripción

**Endpoint:** POST /cancel

**Respuesta Esperada (200):**
```json
{
    "message": "Cancelada al finalizar periodo",
    "plan": "Profesional Anual"
}
```

**Nota:** El plan no termina hasta que se termine la fecha fin

---

## Flujo Completo en Frontend

### Obtener prueba gratuita
1. GET /plans → Ver planes disponibles
2. POST /trial → Solicitar prueba gratuita
3. Ingresar método de pago
4. Obtener premium por 7 días

### Suscribirse
1. GET /plans → Ver planes disponibles
1. POST /subscribe → Seleccionar algún plan premium
3. Ingresar método de pago
4. Obtener premium con plan recurrente

### Cambiar plan
1. Ir a plan actual
2. POST /change-plan → Seleccionar plan diferente
3. Si se cambia a plan inferior se compensan los días del plan anterior
4. Si se cambia a un plan superior se cobra la diferencia

### Cancelar plan
1. Identificar plan actual (debe ser premium)
2. POST /cancel → Cancelar el plan
3. Se cambia a plan básico y se mantienen los beneficios hasta la fecha fin

---

## Seguridad Implementada

- Stripe maneja los datos de tarjetas de los usuarios, por seguridad nosotros solo manejamos los registros para protejer los datos bancarios de los usuarios.
- Rate limiting por endpoint:
  - Trial: 3 intentos cada 24 horas
  - Subscribe: 5 intentos por minuto
- Alertas de seguridad por correo electrónico al realizar cualquier cambio
- Correos de bienvenida y de eventos de suscripcion (suscripcion, cancelación, cambio, etc.)

---

## Notas para Frontend

### Almacenamiento de Tokens (Recomendado)
- Stripe-key: Utilizar la llave pública en frontend para realizar los pagos en frontend

### Consumo de APIs Protegidas
Incluir en cada petición:
Authorization: Bearer {access_token}

---

## Estructura del Código

### authRoutes.ts
**Define todas las rutas y aplica rate limits específicos:**
- POST /plans → subscriptionController.getPlans
- POST /trial → trialLimiter → subscriptionController.startTrial
- POST /subscribe → subscribeLimiter → subscriptionController.subscribe
- POST /change-plan → subscriptionController.changePlan
- POST /cancel → subscriptionController.cancel

### subscriptionController.ts
**Métodos principales:**
- getPlans(): Obtiene todos los planes disponibles para Todonto.
- startTrial(): Asigna el plan de prueba a usuario.
- subscribe(): Asigna un plan de pago a usuario.
- changePlan(): Cambia el plan actual del usuario.
- cancel(): Cancela el plan del usuario y pone el plan inicial.