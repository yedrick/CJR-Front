# API · CJN Campamentos

> Documento generado automáticamente desde `src/api/routes.ts` (`npm run docs:api`). No editar a mano.

Base URL: `VITE_API_URL` (ej. `https://api.cjn.bo/api/v1`). Todas las respuestas son JSON.

## Autenticación

- `POST /auth/login` devuelve `{ user, tokens: { accessToken, refreshToken, expiresIn, tokenType: "Bearer" } }`.
- Enviar `Authorization: Bearer <accessToken>` (JWT HS256, vida corta). Con 401 el cliente llama `POST /auth/refresh` con `{ refreshToken }` (rotación) y reintenta una vez.
- Recomendado en el backend real: refresh token en cookie `httpOnly; Secure; SameSite=Strict`, contraseñas con bcrypt/argon2, límite de intentos (5 fallos → bloqueo 5 min → 429).
- `user.permissions` contiene los permisos efectivos del rol; el backend **siempre** valida el permiso de cada ruta.

## Formato de error

```json
{ "status": 409, "code": "CONFLICT", "message": "Ya estás inscrito en este campamento.", "errors": { "campo": "detalle" }, "retryAfter": 120 }
```

| Código | Uso |
|---|---|
| 400 | Solicitud mal formada / código expirado |
| 401 | Sin token, token vencido o inválido, credenciales incorrectas |
| 403 | Autenticado pero sin permiso, o recurso de otro usuario, o cuenta desactivada |
| 404 | Ruta o recurso inexistente |
| 409 | Conflicto: duplicados, cupo lleno, estado no válido (ej. aprobar un pago ya pagado) |
| 413 | Imagen/comprobante demasiado grande (> 1,5 MB) |
| 422 | Validación de campos (`errors` por campo) |
| 429 | Demasiados intentos (`retryAfter` en segundos y cabecera Retry-After) |
| 500 | Error interno |

## Roles

| Rol | Descripción | Permisos |
|---|---|---|
| `super_admin` Super administrador | Control total del sistema, incluidos usuarios, roles y configuración. | `dashboard:read` `camps:read` `camps:create` `camps:update` `camps:delete` `courses:create` `courses:update` `courses:delete` `tribes:create` `tribes:update` `tribes:delete` `championships:create` `championships:update` `championships:delete` `catalogs:create` `catalogs:update` `catalogs:delete` `registrations:read` `registrations:update` `registrations:delete` `payments:read` `payments:verify` `payments:collect` `payment_settings:update` `checkins:read` `checkins:create` `reports:export` `notifications:send` `users:read` `users:create` `users:update` `users:delete` `roles:read` `roles:update` `system:read` |
| `admin` Administrador | Directiva nacional: gestiona campamentos, inscripciones, pagos y catálogos. | `dashboard:read` `camps:read` `camps:create` `camps:update` `camps:delete` `courses:create` `courses:update` `courses:delete` `tribes:create` `tribes:update` `tribes:delete` `championships:create` `championships:update` `championships:delete` `catalogs:create` `catalogs:update` `catalogs:delete` `registrations:read` `registrations:update` `registrations:delete` `payments:read` `payments:verify` `payments:collect` `payment_settings:update` `checkins:read` `checkins:create` `reports:export` `notifications:send` `users:read` `users:create` `users:update` `roles:read` |
| `tesorero` Tesorería | Verifica comprobantes, cobra en caja y configura los métodos de pago. | `dashboard:read` `camps:read` `registrations:read` `payments:read` `payments:verify` `payments:collect` `payment_settings:update` `reports:export` |
| `coordinador` Coordinador de campamento | Organiza talleres, tribus e inscritos; controla los ingresos. | `dashboard:read` `camps:read` `camps:update` `courses:create` `courses:update` `courses:delete` `tribes:create` `tribes:update` `championships:create` `championships:update` `registrations:read` `registrations:update` `checkins:read` `checkins:create` `reports:export` `notifications:send` |
| `control_acceso` Control de acceso | Escanea credenciales en la puerta y en los talleres. | `camps:read` `registrations:read` `checkins:read` `checkins:create` |
| `campista` Campista | Joven que se inscribe: solo ve y gestiona sus propias inscripciones. | — |

## Permisos

| Permiso | Descripción |
|---|---|
| `dashboard:read` | Ver el resumen del panel |
| `camps:read` | Ver campamentos (incluye borradores) |
| `camps:create` | Crear campamentos |
| `camps:update` | Editar campamentos y marcar el activo |
| `camps:delete` | Eliminar campamentos |
| `courses:create` | Crear talleres |
| `courses:update` | Editar talleres |
| `courses:delete` | Eliminar talleres |
| `tribes:create` | Crear tribus |
| `tribes:update` | Editar tribus |
| `tribes:delete` | Eliminar tribus |
| `championships:create` | Crear campeonatos |
| `championships:update` | Editar campeonatos |
| `championships:delete` | Eliminar campeonatos |
| `catalogs:create` | Crear elementos de catálogos |
| `catalogs:update` | Editar catálogos |
| `catalogs:delete` | Eliminar elementos de catálogos |
| `registrations:read` | Ver todas las inscripciones |
| `registrations:update` | Editar inscripciones |
| `registrations:delete` | Eliminar inscripciones |
| `payments:read` | Ver pagos |
| `payments:verify` | Aprobar o rechazar comprobantes |
| `payments:collect` | Cobrar en caja |
| `payment_settings:update` | Configurar métodos de pago |
| `checkins:read` | Ver registros de ingreso |
| `checkins:create` | Registrar ingresos con el escáner |
| `reports:export` | Exportar reportes |
| `notifications:send` | Enviar avisos a los inscritos |
| `users:read` | Ver usuarios |
| `users:create` | Crear usuarios |
| `users:update` | Editar usuarios y asignar roles |
| `users:delete` | Desactivar o eliminar usuarios |
| `roles:read` | Ver roles y permisos |
| `roles:update` | Modificar permisos de los roles |
| `system:read` | Ver el explorador de API y el estado del sistema |

## Endpoints

### Autenticación

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `POST` | `/auth/login` | Pública | Inicia sesión y devuelve access + refresh token (JWT). | 401, 403, 422, 429 |
| `POST` | `/auth/register` | Pública | Crea una cuenta de campista (el rol lo asigna el servidor). | 409, 422 |
| `POST` | `/auth/refresh` | Pública | Renueva el access token con el refresh token (rotación). | 401 |
| `POST` | `/auth/logout` | Usuario autenticado | Revoca el refresh token de la sesión. | — |
| `GET` | `/auth/me` | Usuario autenticado | Usuario autenticado con sus permisos. | — |
| `PATCH` | `/auth/me` | Usuario autenticado | Actualiza el perfil propio. | 409, 422 |
| `POST` | `/auth/change-password` | Usuario autenticado | Cambia la contraseña (cierra las demás sesiones). | 401, 422 |
| `POST` | `/auth/forgot-password` | Pública | Envía un código de recuperación (respuesta genérica). | 422, 429 |
| `POST` | `/auth/reset-password` | Pública | Restablece la contraseña con el código recibido. | 400, 422 |

### Sistema

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/system/health` | Pública | Estado de la API. | — |

### Campamentos

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/camps` | Pública | Lista de campamentos (los borradores solo con camps:read). | — |
| `GET` | `/camps/:id` | Pública | Detalle de un campamento. | 404 |
| `POST` | `/camps` | camps:create | Crea un campamento. | 403, 422 |
| `PUT` | `/camps/:id` | camps:update | Actualiza un campamento. | 403, 404, 422 |
| `DELETE` | `/camps/:id` | camps:delete | Elimina un campamento sin inscritos. | 403, 404, 409 |
| `POST` | `/camps/:id/feature` | camps:update | Marca el campamento activo (portada). | 403, 404, 409 |

### Talleres

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/courses` | Pública | Talleres (filtro ?campId=). | — |
| `POST` | `/courses` | courses:create | Crea un taller. | 403, 404, 422 |
| `PUT` | `/courses/:id` | courses:update | Actualiza un taller. | 403, 404, 409, 422 |
| `DELETE` | `/courses/:id` | courses:delete | Elimina un taller (lo quita de las inscripciones). | 403, 404 |
| `POST` | `/registrations/:id/courses` | Dueño o registrations:update | Inscribe al joven en un taller (requiere pago confirmado y ventana abierta). | 403, 404, 409, 422 |
| `DELETE` | `/registrations/:id/courses/:courseId` | Dueño o registrations:update | Retira al joven de un taller (antes del cierre). | 403, 404, 409 |

### Campeonatos

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/championships` | Pública | Campeonatos (filtro ?campId=). | — |
| `POST` | `/championships` | championships:create | Crea un campeonato. | 403, 422 |
| `PUT` | `/championships/:id` | championships:update | Actualiza un campeonato. | 403, 404 |
| `DELETE` | `/championships/:id` | championships:delete | Elimina un campeonato. | 403, 404 |
| `GET` | `/championship-entries` | registrations:read · payments:read · championships:update | Inscripciones y equipos de los campeonatos (filtro ?campId=). | — |
| `GET` | `/me/championship-entries` | Usuario autenticado | Campeonatos y equipos del usuario. | — |
| `POST` | `/championship-entries` | Usuario autenticado | Inscripción individual o creación de equipo, con su pago extra. | 403, 404, 409, 413, 422 |
| `DELETE` | `/championship-entries/:id` | Dueño o championships:update | Anula una inscripción a campeonato (sin pago confirmado). | 403, 404, 409 |
| `POST` | `/championship-entries/:id/voucher` | Dueño o payments:verify | Reenvía el comprobante del pago extra. | 403, 404, 409, 413, 422 |
| `DELETE` | `/championship-entries/:id/members/:registrationId` | Dueño o championships:update | El capitán quita a un integrante (o el integrante sale del equipo). | 403, 404, 409 |
| `GET` | `/teams/:code` | Pública | Datos públicos del equipo del enlace de invitación. | 404 |
| `POST` | `/teams/:code/join` | Usuario autenticado | Une al joven al equipo con el código de invitación. | 403, 404, 409 |

### Tribus

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/tribes` | Pública | Las tribus del campamento. | — |
| `POST` | `/tribes` | tribes:create | Crea una tribu. | 403, 409, 422 |
| `PUT` | `/tribes/:id` | tribes:update | Actualiza una tribu. | 403, 404, 409 |
| `DELETE` | `/tribes/:id` | tribes:delete | Elimina una tribu sin integrantes. | 403, 404, 409 |

### Catálogos

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/catalogs` | Pública | Ciudades, sub-directivas, regionales, áreas y tipos. | — |
| `POST` | `/catalogs/:kind` | catalogs:create | Crea un elemento (cities, subdirectivas, regionales, serviceAreas, campTypes). | 403, 404, 409, 422 |
| `PUT` | `/catalogs/:kind/:id` | catalogs:update | Actualiza un elemento del catálogo. | 403, 404, 409 |
| `DELETE` | `/catalogs/:kind/:id` | catalogs:delete | Elimina un elemento (en cascada). | 403, 404, 409 |

### Galería

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/editions` | Pública | Ediciones pasadas y galería. | — |

### Pagos

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/payment-settings` | Pública | Métodos de pago habilitados. | — |
| `POST` | `/coupons/validate` | Usuario autenticado | Valida un cupón de delegación. | 404, 422 |
| `POST` | `/registrations/:id/voucher` | Dueño o payments:verify | Reenvía un comprobante rechazado. | 403, 404, 409, 413, 422 |
| `POST` | `/payments/:registrationId/approve` | payments:verify | Aprueba el comprobante. | 403, 404, 409 |
| `POST` | `/payments/:registrationId/reject` | payments:verify | Rechaza el comprobante con motivo. | 403, 404, 409, 422 |
| `POST` | `/payments/:registrationId/collect` | payments:collect | Registra el cobro en caja. | 403, 404, 409 |
| `PUT` | `/payment-settings` | payment_settings:update | Configura los métodos de pago. | 403, 422 |
| `POST` | `/championship-entries/:id/approve` | payments:verify | Aprueba el pago extra de un campeonato. | 403, 404, 409 |
| `POST` | `/championship-entries/:id/reject` | payments:verify | Rechaza el comprobante del pago extra. | 403, 404, 409, 422 |
| `POST` | `/championship-entries/:id/collect` | payments:collect | Cobra en caja el pago extra. | 403, 404, 409 |

### Inscripciones

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `POST` | `/enrollments` | Pública | Compra del campamento en un solo paso: crea la cuenta (si no hay sesión) y la inscripción. | 404, 409, 413, 422, 429 |
| `GET` | `/me/registrations` | Usuario autenticado | Inscripciones (entradas) del usuario autenticado. | — |
| `POST` | `/registrations` | Usuario autenticado | Inscribe al usuario en un campamento y emite su credencial. | 404, 409, 413, 422 |
| `GET` | `/registrations` | registrations:read · payments:read | Todas las inscripciones (filtro ?campId=). | — |
| `GET` | `/registrations/:id` | Dueño o registrations:read | Detalle de una inscripción. | 403, 404 |
| `PATCH` | `/registrations/:id` | registrations:update | Edita datos, tribu o talleres. | 403, 404, 409, 422 |
| `DELETE` | `/registrations/:id` | registrations:delete | Elimina una inscripción y libera cupos. | 403, 404 |

### Control de acceso

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/checkins` | checkins:read | Ingresos registrados (filtro ?campId=). | — |
| `POST` | `/checkins` | checkins:create | Registra un ingreso con la credencial. | 403, 404, 409 |

### Notificaciones

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/notifications` | Usuario autenticado | Notificaciones del usuario. | — |
| `PATCH` | `/notifications/:id/read` | Usuario autenticado | Marca una notificación como leída. | 403, 404 |
| `POST` | `/notifications/read-all` | Usuario autenticado | Marca todas como leídas. | — |
| `POST` | `/notifications/broadcast` | notifications:send | Envía un aviso a los inscritos. | 403, 422 |
| `POST` | `/notifications/push-subscriptions` | Usuario autenticado | Registra la suscripción Web Push del dispositivo. | — |

### Usuarios

| Método | Ruta | Acceso | Descripción | Errores |
|---|---|---|---|---|
| `GET` | `/users` | users:read | Lista de usuarios. | — |
| `POST` | `/users` | users:create | Crea un usuario del equipo con un rol. | 403, 409, 422 |
| `PATCH` | `/users/:id` | users:update | Edita un usuario o cambia su rol/estado. | 403, 404, 409, 422 |
| `DELETE` | `/users/:id` | users:delete | Elimina un usuario. | 403, 404, 409 |
| `GET` | `/roles` | roles:read · users:read | Roles y sus permisos. | — |
| `PUT` | `/roles/:id` | roles:update | Cambia los permisos de un rol. | 403, 404, 409 |
