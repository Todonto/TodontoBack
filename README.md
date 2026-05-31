![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![Private](https://img.shields.io/badge/license-Private-red)

# Todonto

## ¿Qué es Todonto?

Todonto es una aplicación web que permite a los doctores odontólogos administrar sus citas, crear expedientes y dar seguimiento a cada consulta, permitiendo registrar tratamientos y generar documentos para cada paciente (expedientes, recetas, cartas de consentimiento, etc.). Además, cuenta con un historial de seguimiento para analizar las citas realizadas e identificar periodos con mayor flujo de pacientes.

## Repositorio

Este repositorio contiene el Backend de la aplicación Todonto, en ella se administran los usuarios, subscripciones y pacientes de la aplicación de Todonto. **Solo pueden tener acceso a este repositorio colaboradores directos de la empresa**.

## Tecnologías utilizadas

- Node.js
- Express
- Supabase
- JWT
- Bcrypt

## Estructura del proyecto

```txt
src/
├── controllers/
├── databases/
├── interfaces/
├── middlewares/
├── routes/
├── scripts/
├── services/
└── utils/
```

## Parámetros de Configuración

Para descargar el repositorio se debe de contar antes con las siguientes herramientas.

- Git
- Node.js
- GitHub SSH configurado

### Crear llave SSH para vincular GitHub con el repositorio
Abrir una terminal y ejecutar el siguiente comando para crear una llave secreta:

```bash
ssh-keygen -t ed25519 -C "tu_correo@ejemplo.com"
```

Añadir la llave pública en github.com en Ajustes / SSH and GPG Keys

### Descarga del repositorio

Abrir una terminal y clonar el repositorio en una carpeta identificable

```bash
git clone git@github.com:Todonto/TodontoBack.git
```

### Instalación de dependencias

Abrir la carpeta clonada y ejecutar el siguiente comando para instalar las dependencias necesarias para el proyecto:

```bash
npm install
```

### Variables de entorno

Solicitar llaves secretas que deben ir en el archivo **.env**. (Existe un archivo llamado **.env.example** para ver la estructura de las llaves secretas).

## Ejecución de la aplicación

Para ejecutar la aplicación se debe ejecutar los siguientes comandos:

```bash
npm run watch # Para revisar errores en el proyecto
npm run dev   # Para ejecutar el proyecto localmente
npm run build # Para crear el proyecto para producción
```

Una vez se esté ejecutando el modo local, se puede consumir la aplicación en:

**http://localhost:3000/api**