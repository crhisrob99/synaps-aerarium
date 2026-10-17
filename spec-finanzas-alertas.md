# Spec: Alertas y control de flujo personal (quincenal y mensual)

Herramienta de build: A/CC (Antigravity + Claude Code)
Restriccion: costo $0, reutilizar Synaps (Oracle Cloud + n8n + PostgreSQL) y Telegram como canal de alertas.

## 1. Objetivo
Avisar con anticipacion cada pago e ingreso recurrente, mostrar el margen real de cada quincena y del mes, y permitir registrar gastos variables en segundos desde el celular.

## 2. Decision de arquitectura (simple primero)

| Capa | Fase 1 (MVP, 1 dia) | Fase 2 (opcional) |
|---|---|---|
| Fuente de verdad | Google Sheets (editable desde el celular) | Mismo Sheets |
| Motor de alertas | n8n existente, cron diario 8:00 America/Mexico_City | Igual |
| Canal | Telegram Bot (ya decidido para Synaps) | Igual |
| Captura de gasto variable | Mensaje a Telegram: "gasolina 800" | Parseo con Gemini Flash (failover Groq) |
| Dashboard | Pestana "Resumen" en Sheets | PWA de un solo HTML, lee Sheets publicado |

Por que Sheets y no Postgres: lo editas en el telefono sin codigo, cero mantenimiento, y migrar a Postgres despues es trivial. Punto de falla: si el token OAuth de Google en n8n expira, las alertas dejan de salir. Mitigacion: flujo "heartbeat" que manda un mensaje semanal "sistema vivo"; si no llega, revisar n8n.

## 3. Modelo de datos (Google Sheets)

### Pestana `Recurrentes`
| Columna | Tipo | Ejemplo |
|---|---|---|
| id | texto | auto_mensual |
| concepto | texto | Auto |
| tipo | ingreso / gasto | gasto |
| monto | numero | 5300 |
| frecuencia | mensual / quincenal / bimestral / unico | mensual |
| dia | numero (1-31) o "ultimo" | 25 |
| mes_inicio | numero 1-12 (solo bimestral) | 11 |
| fecha_inicio | fecha | 2026-10-16 |
| fecha_fin | fecha o vacio | 2027-03-16 |
| categoria | texto | Transporte |
| cuenta | texto | BBVA debito |
| es_deuda | SI / NO | SI |
| aviso_dias | numero | 2 |
| activo | SI / NO | SI |

### Pestana `Movimientos` (todo lo real: ingresos extra, gasto variable y pagos efectivos)
fecha, tipo (ingreso / gasto), concepto, monto, categoria, quincena (calculada), origen (telegram / manual / auto)
- Ingreso extra: se registra con tipo = ingreso y categoria = Extra (ej. "extra 1500 bono").
- Los pagos recurrentes se marcan como realizados (origen = auto o manual) para comparar lo planeado contra lo real.

### Pestana `Config`
ingreso_quincenal_promedio, dias_de_pago (ej. 15 y ultimo), umbral_margen_minimo, chat_id_telegram, presupuesto_variable_quincenal por categoria.

### Pestana `Resumen` (formulas, Excel LatAm: coma como separador, sin acentos ni simbolos)
Ejemplo gasto variable acumulado de la quincena actual:
`=SUMAR.SI.CONJUNTO(Movimientos!C:C,Movimientos!E:E,B2)`
(B2 = identificador de quincena actual, ej. 2026-10-Q1)

## 4. Logica de negocio

### 4.1 Calculo de proximas ocurrencias (n8n, nodo Code)
Para cada fila activa, generar fechas de los proximos 45 dias:
- mensual: dia fijo; si el mes no tiene ese dia, usar el ultimo dia del mes.
- quincenal: en las dos fechas de pago definidas en Config.
- bimestral: cada 2 meses desde mes_inicio.
- unico: solo fecha_inicio.
- Excluir fechas fuera de [fecha_inicio, fecha_fin].

### 4.2 Calculo de quincena
Dias de pago confirmados: 14 y 30 (en febrero el 30 se mueve al ultimo dia del mes).
Quincena A = del 14 al 29; Quincena B = del 30 al 13 del mes siguiente. Cada compromiso se asigna a la quincena cuya ventana contiene su fecha.
Margen de quincena = ingreso esperado - gastos recurrentes que caen en la ventana - gasto variable ya registrado - presupuesto variable restante.

### 4.3 Reglas de alerta

| Alerta | Cuando | Mensaje (ejemplo) |
|---|---|---|
| Pago proximo | aviso_dias antes y el mismo dia | "Auto $5,300 vence en 2 dias (25-oct)" |
| Ingreso esperado | dia de pago, 8:00 | "Hoy cae quincena: ~$22,200" |
| Resumen de quincena | primer dia de cada quincena | Ingresos, compromisos por fecha, margen estimado |
| Margen bajo | si margen proyectado < umbral_margen_minimo | "Margen quincena: $X. Revisa gasto variable" |
| Presupuesto variable | al registrar un gasto, si pasa 80% / 100% | "Gasolina 85% de su presupuesto" |
| Fin de deuda | 1 mes antes de fecha_fin | "Ultima mensualidad del prestamo en 30 dias" |
| Limite de gasto | al registrar gasto: 80% y 100% por categoria y global | "Gasolina al 85% de su limite" |
| Proyeccion de rebase | diaria, si el ritmo supera el limite | "A este ritmo rebasas personales el dia 22" |
| Ahorro bajo meta | cierre de quincena y de mes | "Ahorro del mes: $X de $Y (Z%)" |
| Ingreso extra registrado | al capturarlo | "Extra +$1,500. Ahorro del mes: $X" |
| Heartbeat | lunes 9:00 | "Sistema vivo" |

Idempotencia: guardar en pestana `Log_alertas` (id + fecha) cada alerta enviada para no duplicar si el flujo se reejecuta.

### 4.4 Ahorro e ingresos extra
- Ingresos reales de la quincena = sueldo recibido + ingresos extra registrados.
- Egresos reales = recurrentes pagados + gasto variable registrado.
- Ahorro de la quincena = ingresos reales - egresos reales. Ahorro del mes = suma de las dos quincenas.
- Tasa de ahorro = ahorro / ingresos reales.
- Config nueva: meta_ahorro_mensual (sugerencia inicial: el margen proyectado, hoy ~$1,500) y regla opcional para ingresos extra (ej. destinar un % a ahorro).
- Resumen de quincena y de mes: ingreso, egreso, ahorro, avance contra la meta.

### 4.5 Limites de gasto e Inteligencia Preventiva (Burn Rate - Fase 2)
- **Límites Quincenales Variables:** Gasolina ($1,600) y Personales ($3,000) parametrizables en `Parametra`.
- **Temporización Dinámica:**
  - `diasTotales`: 16 días en Q1 (días 14 al 29); 14-16 días en Q2 (día 30 al 13 del mes siguiente).
  - `diasTranscurridos`: días transcurridos desde el inicio de la quincena (mínimo 1).
  - `diasRestantes`: días faltantes para el corte quincenal (mínimo 1 para proyecciones).
- **Métricas de Ritmo y Pacing:**
  - *Ritmo Sugerido:* `Disponible / diasRestantes` ($/día máximo sostenible para no rebasar el límite).
  - *Ritmo Real Actual:* `Consumido / diasTranscurridos` ($/día promedio consumido).
- **Alerta Predictiva de Agotamiento:**
  - A partir del Día 2 (`diasTranscurridos >= 2`), si `Ritmo Actual > Ritmo Sugerido`:
  - `diasParaAgotar = Math.floor(Disponible / Ritmo Actual)`.
  - Si `diasParaAgotar < diasRestantes`, se proyecta la fecha calendario exacta de agotamiento (ej. `20 oct`) y se alerta al usuario tanto en `resumen` como en cada gasto asentado, indicando el nuevo ritmo sugerido de moderación.
- **Protección Anti-Movimientos $0:** Todo mensaje que carezca de un monto numérico válido es rechazado amigablemente con sugerencias de uso y jamás se asienta como gasto $0 en `Acta`.
- **Compromisos Fijos:** Renta, Wendy, Deudas y Servicios se categorizan automáticamente pero no descuentan de los presupuestos variables.

### 4.6 Comandos de Tarjetas (Fides)
- "pague [alias]" / "pagué [alias]": marca pagada = SI en Fides, responde saldo cubierto y fecha limite. Pausa alertas.
- "no pague [alias]" / "no pagué [alias]": revierte pagada = NO en Fides. Reactiva alertas.
- "estado [alias] [monto] [AAAA-MM-DD]": actualiza saldo y fecha limite en Fides, pone pagada = NO. Valida monto > 0 y fecha futura.
- Renovacion de estado de cuenta: en alertas diarias, si pagada = SI y fecha_limite paso, envia alerta unica para renovar con formato.

### 4.7 Comandos Interactivos Bajo Demanda (Fase 2 - Telegram)
- "resumen" / "saldo" / "cómo voy" / "presupuesto": balance quincenal al momento, días restantes de la quincena, consumo vs. límite en Gasolina y Personales con semáforos (🟢/⚠️/🚨), y estado de tarjetas en Fides.
- "deshacer" / "borrar último": elimina la última fila insertada en `Acta` de Google Sheets mediante la operación `deleteRowsAndColumns`, restaurando presupuestos en tiempo real.
- "ayuda" / "comandos": acordeón rápido con ejemplos y sintaxis de todos los comandos soportados.


### 4.8 Dashboard Web / PWA (Tabula Financia)
- **Tecnología:** PWA responsive en un solo archivo HTML (`index.html`) con estética imperial oscura (Obsidian & Roman Gold/Emerald), manifiesto (`manifest.json`), icono SVG vectorial (`icon.svg`) y Service Worker (`sw.js`) para soporte offline.
- **Visualización en Tiempo Real:**
  - Barra de progreso y cronología quincenal (Día X de 16, días restantes para el corte).
  - 4 KPIs principales: Ingreso Quincenal, Compromisos Fijos, Gasto Variable Consumido y Margen Proyectado (con semáforo Saludable/Alerta).
  - Medidores de Presupuesto Variable & Burn Rate: Consumo vs. Límite, saldo disponible, ritmo sugerido ($/día) y ritmo actual ($/día) para Gasolina y Personales.
  - Tarjetas de Crédito (Fides): Saldos sin intereses, días restantes para vencimiento y estado (Pagada / Pendiente).
  - Compromisos Fijos (Vectigalia): Próximos compromisos que vencen en la quincena actual.
  - Movimientos Recientes (Acta): Tabla cronológica de movimientos asentados.
  - Comandos Rápidos: Chips interactivos que copian comandos frecuentes al portapapeles con un toque.
- **Conectividad:**
  - *Modo Webhook n8n (100% Privado):* Conexión directa al endpoint `GET /webhook/aerarium-data` mediante el flujo `synaps_dashboard_api.json`. Los datos jamás se hacen públicos en la web.
  - *Modo Local / Demo:* Permite visualizar métricas y probar la interfaz sin conexión a internet.


## 5. Flujos n8n

1. `fin_alertas_diarias` (Schedule 8:00) -> Google Sheets (leer Recurrentes y Config) -> Code (4.1 y 4.3) -> IF hay alertas -> Telegram -> Sheets (Log_alertas).
2. `fin_resumen_quincena` (Schedule dias de pago) -> calculo 4.2 -> Telegram.
3. `fin_captura_gasto` (Telegram Trigger) -> parseo "concepto monto" (regex primero; Gemini Flash solo si falla) -> Sheets (append Movimientos) -> responde con % de presupuesto.
4. `fin_heartbeat` (Schedule semanal) -> Telegram.
5. `fin_error_trigger`: Error Trigger global -> Telegram con nombre del flujo.
6. `fin_dashboard_api`: Webhook GET `/webhook/aerarium-data` (CORS *) -> Google Sheets (Parametra, Vectigalia, Fides, Acta) -> Code Generar Payload -> Respond to Webhook (JSON con métricas de quincena, burn rate, tarjetas y compromisos).

## 6. Seguridad y privacidad
- Datos financieros personales: Sheets privado, sin compartir; el bot solo responde al chat_id autorizado (validar en el primer nodo).
- Sin numeros de cuenta ni tarjeta completos en ninguna pestana.
- Token de Telegram y credenciales Google solo en n8n Credentials.

## 7. Datos semilla (cargar en `Recurrentes`)

| concepto | tipo | monto | frecuencia | dia | notas |
|---|---|---|---|---|---|
| Sueldo | ingreso | 22200 | quincenal | 14 y 30 (en febrero, ultimo dia) | promedio |
| Renta | gasto | 8400 | mensual | 1 | |
| Gasto hogar (Wendy) | gasto | 5500 | quincenal | 14 y 30 | |
| Internet | gasto | 504 | mensual | 6 | |
| Luz | gasto | 500 | bimestral | por confirmar | aprox. |
| Gas | gasto | 400 | bimestral | por confirmar | alterna con luz |
| Auto | gasto | 5300 | mensual | 25 | aprox. |
| Prestamo Mercado Pago | gasto | 2848.27 | mensual | 16 | del 16-oct-2026 al 16-mar-2027; es_deuda; interes fijo, sin ahorro al liquidar antes (verificar tras el 1er pago) |
| Gasolina | gasto variable | 1600 | quincenal | | presupuesto variable (confirmar que es quincenal) |
| Personales | gasto variable | 3000 | quincenal | | presupuesto variable |

### Pestana `Tarjetas` (fecha limite y saldo cambian cada ciclo)
Las tarjetas NO van como recurrente fijo: el saldo y la fecha limite varian cada mes.

| tarjeta | saldo_pago_sin_intereses | fecha_limite | pagada |
|---|---|---|---|
| BBVA Blue | 3523.71 | 2026-10-26 | NO |
| Mercado Pago | 1598.95 | 2026-11-09 | NO |

Alerta: 3 dias antes y el dia limite si pagada = NO. Actualizacion mensual: el usuario captura saldo y fecha al llegar el estado de cuenta (idea fase 2: leer el correo del estado de cuenta con Gmail y Gemini).

## 8. Plan de implementacion para A/CC

1. Crear Sheets con las 4 pestanas y cargar datos semilla.
2. Construir flujo 1 (alertas diarias) y probar con fechas simuladas (modo prueba que acepte fecha "hoy" por parametro).
3. Construir flujo 3 (captura por Telegram).
4. Flujos 2, 4 y 5.
5. Pruebas: mes con 28 dias, fin de mes (dia "ultimo"), cambio de anio, bimestral, fecha_fin vencida.
6. Fase 2 (solo si hace falta): PWA de un HTML con resumen y grafica de margen por quincena.

## 9. Criterios de aceptacion
- Una alerta por pago, sin duplicados, 2 dias antes y el dia del pago.
- Resumen de quincena correcto contra calculo manual.
- Registro de un gasto por Telegram en menos de 5 segundos.
- Si falla un flujo, llega aviso a Telegram.

## 10. Riesgos y costos futuros
- Costo: $0 (Oracle Always Free + Sheets + Telegram). Gemini solo si el parseo regex falla; con failover a Groq.
- Mantenimiento: reautorizar OAuth de Google si expira; revisar el heartbeat.
- Escalabilidad: Sheets aguanta de sobra este volumen; migrar a PostgreSQL si superas ~10,000 movimientos.
- Dependencia: si Oracle o n8n caen, no hay alertas; el heartbeat es la deteccion.

## 11. Identidad Visual Oficial — Vertex
- **Símbolo e Identidad:** La imagen `Vertex.png` (tetraedro luminoso cian con constelación de nodos orbitales) es el icono y emblema central oficial del ecosistema *Synaps Aerarium*.
- **Directriz de Diseño para Desarrollos Actuales y Futuros:**
  1. **Dashboard & PWA:** Actúa como favicon, icono de aplicación PWA (`manifest.json` y `sw.js`) y avatar principal en la cabecera de `index.html`.
  2. **Evolución Futura:** Todas las siguientes interfaces, extensiones, reportes y dashboards deberán incorporar `Vertex.png` como icono y firma visual del motor de inteligencia financiera.
