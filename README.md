# Global Travel CW — Matriz Unificada de Clientes

Aplicación web de gestión operativa y seguimiento de clientes para **Global Travel CW (Willemstad, Curaçao)**, construida con **Astro 5**, **Tailwind CSS v4** y base de datos serverless **Cloudflare D1**.

---

## Características Principales

- **Tabla Grid Maestra Unificada** con 6 columnas principales fijas:
  1. **Cliente**
  2. **Estatus**
  3. **Fecha**
  4. **Datos del Vuelo**
  5. **Observación**
  6. **Precio**
- **10 Estatus Operativos** con los colores exactos del reporte semanal:
  1. `Pendiente Cotizacion` (`#FF0000`)
  2. `Cotizacion Enviada` (`#FFC000`)
  3. `Reserva por 24h` (`#00B0F0`)
  4. `Reserva Emitida` (`#00FF00`)
  5. `Pago Pendiente Factura` (`#7030A0`)
  6. `Pago Pendiente Tickete` (`#2F5496`)
  7. `Cambio Tickets` (`#FF0066`)
  8. `Visas` (`#CC3399`)
  9. `Consultas` (`#669900`)
  10. `Pagos Demorados(lista negra)` (`#A5A5A5`)
- **Expediente Completo en Ventana Modal (`<dialog>`)**: Al hacer clic sobre cualquier fila se abre la ficha completa con todos los campos editables (incluyendo *Código / Localizador PNR*, *Check-in* y *Lista de Origen*), con opciones para **Guardar Cambios** y **Eliminar Cliente**.
- **Persistencia en Cloudflare D1**: Incluye migración SQL (`migrations/0001_init_clientes.sql`) y semilla automática (`src/constants/clientesSeed.ts`) con los 94 registros iniciales.

---

## Requisitos Previos

- **Node.js** 20+ (o 22+)
- Cuenta en **Cloudflare** (para despliegue en Cloudflare Pages + D1 en producción)

---

## Instalación y Uso Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Inicializar la base de datos D1 local (opcional, también se auto-inicializa al arrancar):**
   ```bash
   npm run db:migrate:local
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre `http://localhost:4321` en tu navegador.

---

## Despliegue en Cloudflare Pages con D1

1. **Crear la base de datos D1 en tu cuenta de Cloudflare:**
   ```bash
   npx wrangler d1 create global-travel-db
   ```
2. **Actualizar `database_id` en `wrangler.jsonc`** con el ID que te devuelva el comando anterior.
3. **Ejecutar la migración inicial en la base de datos remota:**
   ```bash
   npm run db:migrate:remote
   ```
4. **Conectar el repositorio de GitHub en Cloudflare Pages:**
   - Entra a **Workers & Pages > Create application > Pages > Connect to Git**.
   - Selecciona tu repositorio de GitHub.
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - En **Settings > Bindings**, verifica que esté vinculado el binding D1 `DB` hacia `global-travel-db`.
