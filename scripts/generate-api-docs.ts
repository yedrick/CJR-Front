// Genera docs/API.md a partir de src/api/routes.ts y src/auth/permissions.ts
//   npm run docs:api
import { writeFileSync } from 'node:fs';
import { ROUTE_LIST, describeAccess } from '../src/api/routes';
import { DEFAULT_ROLES, PERMISSIONS } from '../src/auth/permissions';

const groups = Array.from(new Set(ROUTE_LIST.map((r) => r.group)));
const lines: string[] = [];
lines.push('# API · CJN Campamentos', '');
lines.push('> Documento generado automáticamente desde `src/api/routes.ts` (`npm run docs:api`). No editar a mano.', '');
lines.push('Base URL: `VITE_API_URL` (ej. `https://api.cjn.bo/api/v1`). Todas las respuestas son JSON.', '');
lines.push('## Autenticación', '');
lines.push('- `POST /auth/login` devuelve `{ user, tokens: { accessToken, refreshToken, expiresIn, tokenType: "Bearer" } }`.');
lines.push('- Enviar `Authorization: Bearer <accessToken>` (JWT HS256, vida corta). Con 401 el cliente llama `POST /auth/refresh` con `{ refreshToken }` (rotación) y reintenta una vez.');
lines.push('- Recomendado en el backend real: refresh token en cookie `httpOnly; Secure; SameSite=Strict`, contraseñas con bcrypt/argon2, límite de intentos (5 fallos → bloqueo 5 min → 429).');
lines.push('- `user.permissions` contiene los permisos efectivos del rol; el backend **siempre** valida el permiso de cada ruta.', '');
lines.push('## Formato de error', '');
lines.push('```json', '{ "status": 409, "code": "CONFLICT", "message": "Ya estás inscrito en este campamento.", "errors": { "campo": "detalle" }, "retryAfter": 120 }', '```', '');
lines.push('| Código | Uso |', '|---|---|');
[
  ['400', 'Solicitud mal formada / código expirado'],
  ['401', 'Sin token, token vencido o inválido, credenciales incorrectas'],
  ['403', 'Autenticado pero sin permiso, o recurso de otro usuario, o cuenta desactivada'],
  ['404', 'Ruta o recurso inexistente'],
  ['409', 'Conflicto: duplicados, cupo lleno, estado no válido (ej. aprobar un pago ya pagado)'],
  ['413', 'Imagen/comprobante demasiado grande (> 1,5 MB)'],
  ['422', 'Validación de campos (`errors` por campo)'],
  ['429', 'Demasiados intentos (`retryAfter` en segundos y cabecera Retry-After)'],
  ['500', 'Error interno'],
].forEach(([c, d]) => lines.push(`| ${c} | ${d} |`));
lines.push('');
lines.push('## Roles', '', '| Rol | Descripción | Permisos |', '|---|---|---|');
DEFAULT_ROLES.forEach((r) => lines.push(`| \`${r.id}\` ${r.name} | ${r.description} | ${r.permissions.length ? r.permissions.map((p) => `\`${p}\``).join(' ') : '—'} |`));
lines.push('', '## Permisos', '', '| Permiso | Descripción |', '|---|---|');
Object.entries(PERMISSIONS).forEach(([k, v]) => lines.push(`| \`${k}\` | ${v} |`));
lines.push('', '## Endpoints', '');
groups.forEach((g) => {
  lines.push(`### ${g}`, '', '| Método | Ruta | Acceso | Descripción | Errores |', '|---|---|---|---|---|');
  ROUTE_LIST.filter((r) => r.group === g).forEach((r) =>
    lines.push(`| \`${r.method}\` | \`${r.path}\` | ${describeAccess(r.access)} | ${r.description} | ${(r.errors || []).join(', ') || '—'} |`)
  );
  lines.push('');
});
writeFileSync('docs/API.md', lines.join('\n'));
console.log(`docs/API.md generado (${ROUTE_LIST.length} rutas)`);
