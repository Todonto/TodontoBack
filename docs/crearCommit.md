## Convención de Commits

Este proyecto utiliza **Commitlint** + **Husky** para estandarizar los mensajes de commits y mantener un historial consistente.

Todos los commits deben seguir el siguiente formato:

```txt
<type>(<scope>): <description>
```

### Tipos permitidos

| Tipo          | Descripción                                        |
| ------------- | -------------------------------------------------- |
| `feature`     | Nueva funcionalidad                                |
| `bug`         | Corrección de errores                              |
| `hotfix`      | Corrección urgente en producción                   |
| `refactor`    | Mejora interna de código sin cambiar funcionalidad |
| `chore`       | Tareas de mantenimiento o configuración            |
| `docs`        | Cambios en documentación                           |
| `test`        | Agregar o modificar pruebas                        |
| `performance` | Mejoras de rendimiento                             |

---

### Scopes permitidos

| Scope        | Descripción                        |
| ------------ | ---------------------------------- |
| `backend`    | Configuración general del backend  |
| `database`   | Base de datos                      |
| `auth`       | Autenticación y autorización       |
| `ui-ux`      | Experiencia visual o estructura UI |
| `api`        | Endpoints y lógica API             |
| `controller` | Controladores                      |
| `model`      | Modelos                            |
| `script`     | Scripts automatizados              |
| `interface`  | Interfaces y tipados               |
| `route`      | Rutas                              |
| `service`    | Servicios                          |
| `util`       | Funciones utilitarias              |
| `other`      | Otros cambios                      |

---

## Ejemplos válidos

```bash
feature(auth): implement jwt authentication

bug(api): validate missing request params

docs(backend): update installation guide

refactor(service): simplify patient service

performance(database): optimize appointments query
```

---

## Ejemplo inválido

```bash
fixed login
```

Razones:

* No contiene `type`
* No contiene `scope`
* No sigue el formato establecido

---

## Validación automática

Los commits son validados automáticamente mediante **Husky** y **Commitlint** antes de ser aceptados en el repositorio.
