# CampFlow: Plataforma de Gestión de Campamentos, Cursos con Cupos, Pagos y Credenciales QR

CampFlow es un sistema integral para campamentos y academias que permite a los participantes inscribirse en cursos organizados por días y franjas horarias con control estricto de cupos, completar su expediente médico y autorizaciones, pagar en línea y obtener su credencial digital con código QR. Para los administradores, ofrece una matriz de horarios, gestión de tribus/equipos con colores personalizables, escáner de asistencia QR y reportes detallados.

---

### Decisiones Críticas Confirmadas

> [!IMPORTANT]
> A partir de las aclaraciones confirmadas para el proyecto, el sistema implementará:
> - **Método de Cobro**: Pasarela digital integrada con simulación de tarjeta bancaria, generación automática de recibo fiscal y emisión inmediata de credencial/comprobante QR.
> - **Estructura de Grupos**: Tribus y equipos parametrizables con paleta de colores personalizable (código HEX, nombre de tribu y líder), credenciales con gafete cromático y reportes filtrados por color.
> - **Estilo Visual**: Estética Campamento Aventura con tonos verde bosque (`#1B4332`), musgo profundo (`#2D6A4F`), beige cálido/arena (`#FBF8F3`) y acentos madera/cedro (`#7F4F24`), bajo los principios de diseño de alta densidad y anti-slop.

---

## 1. Visión General y Concepto Central

### Qué Hace la Aplicación
1. **Portal Público de Inscripción y Matrícula**:
   - Exploración interactiva del campamento, fechas, tarifas y catálogo de talleres/cursos clasificados por turnos (ej. 10 cursos simultáneos en la mañana de 09:00 a 11:00, talleres de tarde, etc.).
   - Selección de cursos con control en tiempo real de cupo máximo (ej. cupo de 20 o 25 estudiantes por taller) y bloqueo automático de solapamientos horarios.
   - Formulario exhaustivo de datos personales, ficha médica (alergias, medicamentos, tipo de sangre, restricciones alimentarias), contactos de emergencia y autorizaciones legales/fotográficas.
   - Checkout con tarjeta de crédito/débito, cálculo de tarifas e impuestos, y generación inmediata de la credencial de campista con código QR y pase de acceso descargable.

2. **Panel Administrativo (Control Master del Campamento)**:
   - **Gestor de Cursos y Horarios**: Creación de cursos por día, turno, franja horaria, instructor, ubicación del campamento y cupo límite con barra de ocupación en vivo.
   - **Gestor de Tribus / Grupos de Color**: Parametrización de equipos (ej. *Tribu Halcón Dorado*, *Tribu Puma Carmesí*, *Tribu Nutria Esmeralda*, *Tribu Cóndor Azul*), personalización del color representativo, asignación manual o automática de estudiantes y generación de listas de equipo.
   - **Expedientes de Estudiantes y Ficha Médica**: Vista centralizada de cada campista con historial de cursos matriculados, estado de pago, alertas médicas destacadas (alergias severas, medicación requerida) y contactos de emergencia con llamada rápida.
   - **Validador / Escáner QR de Asistencia**: Interfaz para escanear o ingresar el código QR del campista, registrando check-in y check-out en el curso o en la entrada general del campamento.
   - **Reportes y Exportación**: Generación de informes analíticos filtrables por tribu/color, por curso, por turno horario o por condición médica, con exportación a formato imprimible/CSV.

### Audiencia Objetivo
- **Padres de Familia y Campistas**: Proceso de registro intuitivo, transparente en cupos disponibles y seguro para compartir información médica.
- **Directores del Campamento y Coordinadores**: Vista panorámica de ingresos, ocupación de talleres al 100%, seguridad médica y distribución balanceada por tribus.
- **Monitores y Paramédicos**: Consulta rápida de fichas de emergencia y validación de asistencia con escáner QR en campo.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos Clave de Usuario
1. **Flujo de Matrícula (Público)**:
   - **Paso 1: Datos del Estudiante y Tutor**: Nombre, fecha de nacimiento, edad, teléfono tutor, documento de identidad.
   - **Paso 2: Expediente Médico y Consentimientos**: Alergias, dieta especial, seguro médico, tratamiento farmacológico, contacto de emergencia 1 y 2, autorización de actividades y uso de imagen.
   - **Paso 3: Selección de Cursos por Días y Franjas Horarias**: Vista tipo cuadrícula/agenda donde se muestran los talleres disponibles por franja (mañana 09:00-11:00, mediodía 11:30-13:30, tarde 15:00-17:00). Cada tarjeta muestra plazas totales, plazas ocupadas y plazas restantes (ej. *18/20 ocupados*). Si una franja ya tiene curso seleccionado, se advierte para evitar cruces.
   - **Paso 4: Resumen y Pasarela de Pago**: Desglose del pase general de campamento + cuotas de materiales de talleres especializados. Formulario de pago seguro simulado con validación instantánea.
   - **Paso 5: Emisión de Credencial QR**: Pantalla de confirmación con el gafete oficial del campista mostrando su código QR único, color de su tribu asignada, cursos inscritos y botón para imprimir o descargar credencial.

2. **Flujo de Administración y Operaciones**:
   - **Dashboard**: Métricas clave (total inscritos, ingresos cobrados, capacidad global utilizada, alertas médicas pendientes de revisión).
   - **Programador de Cursos**: Tabla y calendario con filtros por día. Capacidad para agregar nuevos cursos, fijar cupo (10, 20, 25, 30), asignar instructor y ver la nómina de inscritos con 1 clic.
   - **Configurador de Tribus de Color**: Selector de color HEX nativo, nombre de grupo, emblema y regla de distribución.
   - **Puesto de Control QR**: Lector de cámara web o simulador de pistola lectora de códigos QR para pase de lista en tiempo real.

### Identidad Visual y Paleta de Colores
- **Atmósfera**: Aventura campestre contemporánea, confiable, orgánica y enérgica sin caer en estridencias infantiles baratas.
- **Tokens de Color Tailwind**:
  - `Canvas Principal`: Arena cálida suave `#FBF8F3` (fondo descansado para la vista).
  - `Superficies Estructurales`: Blanco puro `#FFFFFF` y Marfil `#F4EFE6` con bordes sutiles en tono tierra suave `#E6DEC8`.
  - `Primario / Bosque`: Verde Pino Profundo `#1B4332` y Musgo Silvestre `#2D6A4F` para encabezados y acciones prioritarias.
  - `Acentos Cálidos`: Ámbar Tierra `#D48B47` y Ocre `#C06C84` para estados destacados.
  - `Paleta Dinámica de Tribus`: Colores configurables por el usuario con valores iniciales equilibrados:
    - Carmesí Aventura (`#DC2626`)
    - Azul Glaciar (`#2563EB`)
    - Esmeralda Selva (`#059669`)
    - Ámbar Solar (`#D97706`)
    - Amatista Cañón (`#7C3AED`)
- **Tipografía**:
  - Encabezados: `Plus Jakarta Sans` con peso SemiBold y espaciado ajustado.
  - Texto de lectura: `DM Sans` para formularios legibles y microcopia nítida.
  - Cifras y Códigos: `JetBrains Mono` con `font-variant-numeric: tabular-nums` para cupos, importes, horas y seriales QR.
- **Disciplina Anti-Slop**:
  - Sin píldoras flotantes estáticas ni tarjetas dentro de tarjetas con bordes gruesos.
  - Metadatos presentados con separadores limpios (`·` o `/`).
  - Indicadores de cupo mediante barras de progreso finas y precisas con cifras tabulares (ej. `23 / 25 cupos`).

---

## 3. Decisiones de Producto y Arquitectura

### Decisión 1: Motor de Validación de Horarios y Cupos Concurrente
- **Enfoque**: Modelo de reservas con verificación estricta de conflictos temporales y conteo reactivo de cupos. Un usuario no puede seleccionar dos cursos que coincidan en el mismo día y rango horario.
- **Motivo**: Previene la sobreventa de talleres físicos y garantiza que no haya campistas con horarios duplicados.

### Decisión 2: Ficha Médica Integral y Clasificación de Riesgo
- **Enfoque**: Módulo clínico estructurado con categorización de severidad (alergias con anafilaxia, medicación de horario estricto, contacto de emergencia primario y secundario con parentesco).
- **Motivo**: En un campamento físico la seguridad física es crítica; los monitores necesitan acceso instantáneo a las advertencias médicas desde la credencial QR o el panel.

### Decisión 3: Generación de QR Autónomo y Offline-Ready
- **Enfoque**: Generación de códigos QR vectoriales basados en un payload estandarizado que contiene el ID de inscripción, código de verificación, nombre del campista y código de tribu.
- **Motivo**: Permite validar la credencial en cualquier punto del campamento incluso si hay conectividad intermitente, desplegando la información del campista en pantalla de forma instantánea.

### Decisión 4: Simulación Realista de Pasarela de Pagos
- **Enfoque**: Integración de procesamiento de pagos con validación de tarjeta con algoritmo Luhn, desglose de impuestos/descuentos por hermanos, comprobante de pago foliado y registro en el libro contable de la plataforma.

---

## 4. Arquitectura Técnica y Estrategia de Datos

### Diagrama de Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CampFlow Platform                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│        Vistas Públicas               │  │        Vistas Administrativas        │
├──────────────────────────────────────┤  ├──────────────────────────────────────┤
│ • Catálogo de Cursos por Día/Hora    │  │ • Matriz de Horarios y Cupos         │
│ • Wizard de Matrícula (4 Pasos)      │  │ • Gestor de Tribus y Colores         │
│ • Expediente Médico & Consentimientos│  │ • Expedientes Médicos y Asistencia    │
│ • Pasarela de Pago & Facturación     │  │ • Escáner / Validador QR de Acceso   │
│ • Credencial Oficial con Código QR   │  │ • Reportes Analíticos y Filtros      │
└──────────────────┬───────────────────┘  └──────────────────┬───────────────────┘
                   │                                         │
                   └────────────────────┬────────────────────┘
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Capa de Estado Central                           │
│  • Storage reactivo con sincronización local y estado tipado           │
│  • Motor de cálculo de cupos y resolución de solapamientos horarios    │
│  • Generador y decodificador de códigos QR                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Entidades y Modelos de Datos

1. **Course (Curso / Taller)**:
   - `id`: string
   - `title`: string
   - `category`: string (Deportes, Arte, Ciencia, Supervivencia, etc.)
   - `day`: string (Lunes a Domingo o Días 1 a 5)
   - `startTime`: string (ej. "09:00")
   - `endTime`: string (ej. "11:00")
   - `location`: string (ej. "Pabellón Náutico", "Cancha Central")
   - `instructor`: string
   - `maxCapacity`: number (ej. 20 o 25)
   - `price`: number
   - `enrolledCount`: number

2. **CamperRegistration (Inscripción del Campista)**:
   - `id`: string (ej. "CMP-2026-8812")
   - `qrPayload`: string
   - `fullName`: string
   - `birthDate`: string
   - `age`: number
   - `guardianName`: string
   - `guardianPhone`: string
   - `guardianEmail`: string
   - `tribeId`: string
   - `enrolledCourseIds`: string[]
   - `status`: 'active' | 'cancelled' | 'pending'
   - `checkInHistory`: Array<{ courseId: string; timestamp: string }>

3. **MedicalRecord (Ficha Médica y Legal)**:
   - `allergies`: string (alimentos, picaduras, medicamentos)
   - `hasEpipen`: boolean
   - `bloodType`: string
   - `dailyMedications`: string
   - `dietaryRestrictions`: string
   - `emergencyContactName`: string
   - `emergencyContactPhone`: string
   - `emergencyRelationship`: string
   - `activityWaiverSigned`: boolean
   - `photoConsent`: boolean

4. **TribeColorGroup (Tribu o Categoría Parametrizable)**:
   - `id`: string
   - `name`: string (ej. "Tribu Puma")
   - `colorHex`: string (ej. "#DC2626")
   - `leaderName`: string
   - `motto`: string
   - `camperCount`: number

5. **PaymentTransaction (Transacción de Pago)**:
   - `id`: string
   - `registrationId`: string
   - `amount`: number
   - `currency`: string ('USD' / 'EUR' / 'MXN')
   - `date`: string
   - `paymentMethod`: 'credit_card' | 'debit_card' | 'transfer'
   - `lastFourDigits`: string
   - `status`: 'completed' | 'refunded'
   - `invoiceNumber`: string
