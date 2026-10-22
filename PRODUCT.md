# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pesan lo mismo dos públicos: la plataforma solo funciona si funciona para los dos (confirmado).

- **Jóvenes que se inscriben.** Jóvenes de la Unión Cristiana Evangélica en Bolivia. Eligen un campamento y se inscriben, solos o en delegación. Pagan, reciben su credencial con QR y, después de pagar, se anotan en talleres y olimpiadas o arman equipos. Según el código: PWA instalable, en vertical, pensada para el celular, y rango de edad configurable por campamento (35 años por defecto como máximo).
- **Directiva y equipo de staff.** Operan el panel de administración y cada uno tiene un rol: super administrador, administrador, tesorería, coordinación y control de acceso (según el código). Sus tareas son:
  - crear campamentos, talleres, tribus y campeonatos;
  - verificar comprobantes y cobrar en caja;
  - escanear credenciales en la entrada;
  - enviar avisos y exportar reportes.

## Product Purpose

Es la plataforma de inscripción y operación de los campamentos del **Comité Juvenil Nacional (CJN)**. Reúne en un solo lugar:

- la inscripción y el pago del joven;
- su credencial;
- la gestión del evento para la directiva: pagos, cupos, tribus, accesos y avisos.

El éxito se ve en dos frentes. El joven termina su inscripción y su pago sin ayuda. La directiva valida pagos y controla la entrada sin planillas paralelas.

## Positioning

Es la herramienta propia del CJN, no un formulario genérico de eventos. Conoce la estructura del comité: las regionales y sus subdirectivas, las tribus, los talleres con cupo y ventana de inscripción, y las olimpiadas bíblicas y deportivas. También conoce los medios de pago que se usan en Bolivia: QR bancario, transferencia con comprobante y efectivo en caja.

## Operating Context

Según el código:

- **Calendario.** Varios campamentos al año en distintas ciudades de Bolivia: nacional, regionales y otros tipos, que son un catálogo editable. Cada uno pasa por estas fases: borrador, abierto, cerrado, en curso y finalizado.
- **Pagos.**
  - Montos en bolivianos (Bs).
  - El joven sube la foto del comprobante y tesorería la verifica.
  - Si el comprobante se rechaza, el joven puede reenviarlo.
  - En la sede también se cobra en efectivo.
  - Hay cupones de grupo para delegaciones.
- **Durante el campamento.** El control de acceso escanea el QR de la credencial para registrar ingresos y asistencia a talleres. Las notificaciones se consultan periódicamente y hay push opcional.
- **Backend.** El backend real todavía no está conectado: con `VITE_USE_MOCK_API=true` toda la API corre simulada en el navegador.

## Capabilities and Constraints

- La interfaz, los textos y los mensajes van en **español**.
- La terminología es propia del comité: campamento, campista, inscripción, credencial, taller, tribu, olimpiadas/campeonato, equipo, regional, subdirectiva, delegación, comprobante, caja.
- El acceso al panel se decide por permisos, no por nombre de rol, porque los roles son editables.
- **Nombre.** El nombre oficial es "Comité Juvenil Nacional", con sigla **CJN** (confirmado). En el código aparecen "Comité Juvenil Regional" y "CJR" como nombre de la organización: son errores y hay que corregirlos. "Regional" solo es correcto para cada una de las regionales del catálogo.

## Brand Commitments

- Nombre: Comité Juvenil Nacional (CJN), de la Unión Cristiana Evangélica.
- Hay un **logo oficial** (confirmado).
- **Sin decidir:** si [src/components/common/CJNLogo.tsx](src/components/common/CJNLogo.tsx) y `public/icons/icon.svg` reproducen ese logo oficial o son una versión provisional. Hay que confirmarlo antes de usarlos como identidad definitiva.

## Evidence on Hand

- **Logo oficial:** existe, pero falta confirmar el archivo fuente.
- **Fotos:** no hay fotos reales de campamentos. Todas las imágenes actuales son de stock (Unsplash, en [src/config/media.ts](src/config/media.ts)). No hay que presentarlas como fotos del CJN.
- **Cifras y testimonios:** no hay reales. No hay que inventar cantidades de asistentes, ediciones, testimonios ni citas. Los datos de [src/data/initialData.ts](src/data/initialData.ts) y del mock son de ejemplo, no evidencia.

## Product Principles

1. **Dos públicos con el mismo peso.** Una mejora para el joven no puede complicar la operación de la directiva, y una mejora para la directiva no puede complicar al joven.
2. **El joven debe poder terminar sin ayuda.** Inscribirse, pagar, reenviar un comprobante y encontrar su credencial tienen que poder hacerse solos, desde el celular.
3. **El dinero tiene que estar claro.** Montos, estados de pago y motivos de rechazo se muestran sin ambigüedad, con los mismos textos en las dos caras.
4. **Solo contenido real.** Nada de cifras, testimonios ni fotos inventadas presentadas como propias.
