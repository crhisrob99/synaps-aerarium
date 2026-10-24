// 1. Validar seguridad dinámica con telegram_chat_id de Parametra
const incomingMsg = $('Telegram Trigger').first().json.message;
const incomingChatId = incomingMsg?.chat?.id?.toString() || '';

const parametra = $('Leer Parametra').all().map(i => i.json).filter(j => j && j.parametro);
const authorizedChatId = parametra.find(p => p.parametro === 'telegram_chat_id')?.valor?.toString() || '';

if (!incomingChatId || incomingChatId !== authorizedChatId) {
  return []; // Ignorar mensaje no autorizado
}

const rawText = (incomingMsg?.text || '').trim();
if (!rawText) return [];

// Fecha y hora local estricta en America/Mexico_City
const now = new Date();
const mxDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
const mxTimeStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });
const [year, monthStr, dayStr] = mxDateStr.split('-');
const currentYear = parseInt(year);
const currentMonth = parseInt(monthStr);
const currentDay = parseInt(dayStr);
const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

// Identificador de quincena
let quincenaTag = '';
let isQ1 = false;
let diasRestantes = 0;

if (currentDay >= 14 && currentDay <= 29) {
  quincenaTag = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-Q1';
  isQ1 = true;
  diasRestantes = 29 - currentDay;
} else if (currentDay >= 30) {
  quincenaTag = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-Q2';
  isQ1 = false;
  diasRestantes = (daysInMonth - currentDay) + 13;
} else {
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }
  quincenaTag = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-Q2';
  isQ1 = false;
  diasRestantes = 13 - currentDay;
}

// Días totales y transcurridos de la quincena
let diasTotales = 0;
let diasTranscurridos = 0;

if (isQ1) {
  diasTotales = 16;
  diasTranscurridos = (currentDay - 14) + 1;
} else if (currentDay >= 30) {
  const diasMesFin = (daysInMonth - 30) + 1;
  diasTotales = diasMesFin + 13;
  diasTranscurridos = (currentDay - 30) + 1;
} else {
  let prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
  const diasMesFin = (prevMonthDays - 30) + 1;
  diasTotales = diasMesFin + 13;
  diasTranscurridos = diasMesFin + currentDay;
}
diasTranscurridos = Math.max(1, diasTranscurridos);
const diasRestantesCalc = Math.max(1, diasRestantes);

const normalize = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const textNorm = normalize(rawText);

const fides = $('Leer Fides (Tarjetas)').all().map(i => i.json).filter(j => j && j.tarjeta);
const vectigalia = $('Leer Vectigalia').all().map(i => i.json).filter(j => j && j.id && j.activo === 'SI');
const acta = $('Leer Acta (Movimientos)').all().map(i => i.json).filter(j => j && j.tipo);

// -------------------------------------------------------------------------
// COMANDO: AYUDA / COMANDOS
// -------------------------------------------------------------------------
if (/^(ayuda|comandos|help|\/help|\/start)$/i.test(textNorm)) {
  const ayudaMsg = "🏛️ *Synaps Aerarium — Comandos Disponibles*\n━━━━━━━━━━━━━━━━━━━━\n" +
    "🛒 *Registrar Gastos Variables:*\n" +
    "▫️ `gasolina 500` / `super 850` / `farmacia 220` / `cafe 65`\n\n" +
    "💵 *Registrar Ingresos Extra:*\n" +
    "▫️ `extra 1500 bono` / `ingreso 2000 freelance`\n\n" +
    "📊 *Consultas al Vuelo:*\n" +
    "▫️ `resumen` o `cómo voy` — Estado de presupuestos y balance\n" +
    "▫️ `deshacer` — Elimina el último movimiento registrado en Acta (verificado)\n\n" +
    "💳 *Control de Tarjetas de Crédito:*\n" +
    "▫️ `pagué bbva` / `pagué mp` — Marca pagada y apaga recordatorios\n" +
    "▫️ `no pagué bbva` — Reactiva alertas de vencimiento\n" +
    "▫️ `estado bbva 4200 2026-11-26` — Asienta nuevo saldo y fecha\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "_Tus compromisos fijos (Wendy, Auto, Préstamos) se avisan solos a las 8:00 AM._";

  return [{
    json: {
      chat_id: incomingChatId,
      accion: 'solo_mensaje',
      mensaje: ayudaMsg
    }
  }];
}

// -------------------------------------------------------------------------
// COMANDO: RESUMEN / SALDO / CÓMO VOY / PRESUPUESTO
// -------------------------------------------------------------------------
if (/^(resumen|saldo|presupuesto|como\s+voy|balance)$/i.test(textNorm)) {
  const pGasolina = parseFloat(parametra.find(p => p.parametro === 'presupuesto_gasolina_quincenal')?.valor || 1600);
  const pPersonales = parseFloat(parametra.find(p => p.parametro === 'presupuesto_personales_quincenal')?.valor || 3000);
  const pTotal = pGasolina + pPersonales;

  // Gastos de la quincena en Acta
  const gastosQ = acta.filter(r => r.tipo === 'gasto' && r.quincena === quincenaTag);
  const gGas = gastosQ.filter(r => r.categoria === 'Transporte').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
  const gPer = gastosQ.filter(r => r.categoria === 'Personales').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
  
  // Contar Hogar, Salud y Servicios variables como otros variables en el resumen
  const gOtrosVar = gastosQ.filter(r => r.categoria !== 'Transporte' && r.categoria !== 'Personales').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
  const gTotalVar = gGas + gPer + gOtrosVar;

  const pctGas = Math.round((gGas / pGasolina) * 100);
  const pctPer = Math.round((gPer / pPersonales) * 100);

  const dispGas = Math.max(0, pGasolina - gGas);
  const dispPer = Math.max(0, pPersonales - gPer);

  // Semáforos visuales
  const semGas = (pctGas >= 100) ? '🚨' : (pctGas >= 80 ? '⚠️' : '🟢');
  const semPer = (pctPer >= 100) ? '🚨' : (pctPer >= 80 ? '⚠️' : '🟢');

  // Ritmo sugerido y burn rate SOLO para Personales (quitado para Gasolina)
  const ritmoPerSugerido = Math.round(dispPer / diasRestantesCalc);
  const ritmoPerActual = Math.round(gPer / diasTranscurridos);

  // Alertas predictivas de agotamiento anticipado: exclusivamente Personales
  let alertasPredictivas = [];

  if (diasTranscurridos >= 2 && dispPer > 0 && gPer > 0) {
    if (ritmoPerActual > ritmoPerSugerido) {
      const diasParaAgotar = Math.floor(dispPer / ritmoPerActual);
      if (diasParaAgotar < diasRestantes) {
        const agotamientoDate = new Date(now.getTime() + diasParaAgotar * 24 * 60 * 60 * 1000);
        const fechaStr = agotamientoDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' });
        alertasPredictivas.push('⚠️ *Ritmo alto en Personales:* Gastas ~$' + ritmoPerActual + '/día. A este paso se agota el *' + fechaStr + '* (' + diasParaAgotar + ' días). Modera a *$' + ritmoPerSugerido + '/día*.');
      }
    }
  }

  // Tarjetas en Fides
  let cardsStr = fides.map(c => {
    const isPaid = (c.pagada === 'SI');
    const estado = isPaid ? '✅ Pagada' : '⏳ Pendiente';
    const saldoNum = parseFloat(c.saldo_pago_sin_intereses || 0);
    return '  ▫️ *' + c.tarjeta + ':* $' + saldoNum.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' (' + c.fecha_limite + ') — ' + estado;
  }).join('\n');

  // Días de fin de quincena
  const finQuincenaTexto = isQ1 ? '29 de ' + now.toLocaleString('es-MX', { month: 'short' }) : '13 del siguiente mes';

  let resumenMsg = "🏛️ *Synaps Aerarium — Balance al Vuelo*\n━━━━━━━━━━━━━━━━━━━━\n" +
    "📅 *Periodo:* `" + quincenaTag + "` (Día " + diasTranscurridos + " de " + diasTotales + ")\n" +
    "⏳ *Corte quincenal:* Faltan *" + diasRestantes + " día(s)* (el " + finQuincenaTexto + ")\n\n" +
    semGas + " *Gasolina:* $" + gGas.toLocaleString('es-MX', {minimumFractionDigits: 2}) + " / $" + pGasolina.toLocaleString('es-MX') + " (" + pctGas + "%)\n" +
    "   👉 *Disponible:* $" + dispGas.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "\n\n" +
    semPer + " *Personales:* $" + gPer.toLocaleString('es-MX', {minimumFractionDigits: 2}) + " / $" + pPersonales.toLocaleString('es-MX') + " (" + pctPer + "%)\n" +
    "   👉 *Disponible:* $" + dispPer.toLocaleString('es-MX', {minimumFractionDigits: 2}) + " | *Sugerido:* $" + ritmoPerSugerido + "/día\n\n";

  if (gOtrosVar > 0) {
    resumenMsg += "📦 *Otros Variables (Hogar/Salud/Servicios):* $" + gOtrosVar.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "\n\n";
  }

  resumenMsg += "🛒 *Total Variable Consumido:* $" + gTotalVar.toLocaleString('es-MX', {minimumFractionDigits: 2}) + " (Base Gasolina + Personales: $" + pTotal.toLocaleString('es-MX') + ")\n";

  if (alertasPredictivas.length > 0) {
    resumenMsg += "━━━━━━━━━━━━━━━━━━━━\n" + alertasPredictivas.join("\n\n") + "\n";
  }

  resumenMsg += "━━━━━━━━━━━━━━━━━━━━\n" +
    "💳 *Tarjetas de Crédito (Fides):*\n" +
    (cardsStr || '  ▫️ Sin tarjetas registradas') + "\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "_Escribe cualquier gasto (ej:_ `gasolina 500`_) o_ `deshacer` _para corregir._";

  return [{
    json: {
      chat_id: incomingChatId,
      accion: 'solo_mensaje',
      mensaje: resumenMsg
    }
  }];
}

// -------------------------------------------------------------------------
// COMANDO: DESHACER / BORRAR ÚLTIMO (CON VERIFICACIÓN ESTRICTA DE FILA)
// -------------------------------------------------------------------------
if (/^\/?(deshacer|borrar|cancelar|undo)(\s+(ultimo|movimiento|gasto))?[\.\s]*$/i.test(textNorm)) {
  const allActaRaw = $('Leer Acta (Movimientos)').all().map(i => i.json);

  if (allActaRaw.length === 0 || acta.length === 0) {
    return [{
      json: {
        chat_id: incomingChatId,
        accion: 'solo_mensaje',
        mensaje: "❓ *Nada que deshacer:*\nNo hay movimientos registrados en Acta en este momento."
      }
    }];
  }

  const ultimoMovimiento = acta[acta.length - 1];
  const ultimaFilaRaw = allActaRaw[allActaRaw.length - 1];

  // Verificar que la última fila física en Google Sheets coincida exactamente con el último movimiento
  const mismoConcepto = (ultimaFilaRaw.concepto || '').trim().toLowerCase() === (ultimoMovimiento.concepto || '').trim().toLowerCase();
  const mismoMonto = Math.abs((parseFloat(ultimaFilaRaw.monto) || 0) - (parseFloat(ultimoMovimiento.monto) || 0)) < 0.01;
  const mismaFecha = (ultimaFilaRaw.fecha || '').split(' ')[0] === (ultimoMovimiento.fecha || '').split(' ')[0];

  if (!mismoConcepto || !mismoMonto || !mismaFecha) {
    return [{
      json: {
        chat_id: incomingChatId,
        accion: 'solo_mensaje',
        mensaje: "⚠️ *Seguridad de Datos:* No se pudo verificar la última fila.\nLa última fila física en Google Sheets no coincide con el último movimiento registrado en memoria.\nPara evitar borrar datos incorrectos, la eliminación fue cancelada."
      }
    }];
  }

  const montoNum = parseFloat(ultimoMovimiento.monto || 0);

  // En Google Sheets, Fila 1 es el encabezado.
  // La última fila física verificada es allActaRaw.length + 1.
  const filaABorrar = allActaRaw.length + 1;

  const undoMsg = "🏛️ *Synaps Aerarium — Movimiento Cancelado*\n━━━━━━━━━━━━━━━━━━━━\n" +
    "🗑️ *Se eliminó de Acta (Fila " + filaABorrar + " verificada):*\n" +
    "📝 *Concepto:* " + (ultimoMovimiento.concepto || 'Varios') + "\n" +
    "💰 *Monto:* $" + montoNum.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "\n" +
    "🏷️ *Categoría:* " + (ultimoMovimiento.categoria || 'Personales') + "\n" +
    "📅 *Fecha:* " + (ultimoMovimiento.fecha || 'N/A') + "\n" +
    "━━━━━━━━━━━━━━━━━━━━\n" +
    "_Fila eliminada de Google Sheets. Tus presupuestos se han recalculado en tiempo real._";

  return [{
    json: {
      chat_id: incomingChatId,
      accion: 'delete_last_acta',
      startIndex: filaABorrar,
      endIndex: filaABorrar + 1,
      fila_a_borrar: filaABorrar,
      cantidad_filas: 1,
      mensaje: undoMsg
    }
  }];
}

// -------------------------------------------------------------------------
// COMANDOS DE TARJETAS: "pague / pagué [alias]" y "no pague / no pagué [alias]"
// -------------------------------------------------------------------------
function findCard(query, list) {
  const q = normalize(query);
  if (!q) return null;
  return list.find(c => {
    const name = normalize(c.tarjeta);
    if (name === q) return true;
    if (q === 'bbva' && name.includes('bbva')) return true;
    if ((q === 'mp' || q === 'mercado pago') && name.includes('mercado pago')) return true;
    if (name.includes(q) || q.includes(name)) return true;
    return false;
  }) || null;
}

const payMatch = textNorm.match(/^(no\s+)?pague\s+(.+)$/i);
if (payMatch) {
  const isNoPay = Boolean(payMatch[1]);
  const targetQuery = payMatch[2].trim();
  const card = findCard(targetQuery, fides);

  if (card) {
    // Coincidencia con tarjeta de crédito en Fides
    const newPagada = isNoPay ? 'NO' : 'SI';
    const saldoNum = parseFloat(card.saldo_pago_sin_intereses || 0);

    let msg = '';
    if (newPagada === 'SI') {
      msg = '🏛️ *Synaps Aerarium — Tarjeta Liquidada*\n━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ *Tarjeta:* ' + card.tarjeta + '\n' +
        '💰 *Saldo cubierto:* $' + saldoNum.toLocaleString('es-MX', {minimumFractionDigits: 2}) + '\n' +
        '📅 *Fecha Límite:* ' + card.fecha_limite + '\n' +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '_Estatus actualizado a PAGADA (SI). Ya no recibirás alertas de vencimiento para este periodo._';
    } else {
      msg = '🏛️ *Synaps Aerarium — Estatus Revertido*\n━━━━━━━━━━━━━━━━━━━━\n' +
        '⚠️ *Tarjeta:* ' + card.tarjeta + '\n' +
        '💰 *Saldo pendiente:* $' + saldoNum.toLocaleString('es-MX', {minimumFractionDigits: 2}) + '\n' +
        '📅 *Fecha Límite:* ' + card.fecha_limite + '\n' +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '_Estatus revertido a PENDIENTE (NO). Se reactivan las alertas de vencimiento._';
    }

    return [{
      json: {
        chat_id: incomingChatId,
        accion: 'update_fides',
        tarjeta: card.tarjeta,
        saldo_pago_sin_intereses: saldoNum,
        fecha_limite: card.fecha_limite,
        pagada: newPagada,
        mensaje: msg
      }
    }];
  } else if (isNoPay) {
    // Si explícitamente dijo "no pagué X" y no es tarjeta, avisar
    const cardsList = fides.map(c => '  ▫️ ' + c.tarjeta).join('\n');
    return [{
      json: {
        chat_id: incomingChatId,
        accion: 'solo_mensaje',
        mensaje: '❓ *Tarjeta no identificada:*\nNo encontré coincidencia para "' + targetQuery + '".\n\n📋 *Tarjetas disponibles en Fides:*\n' + (cardsList || '  ▫️ Ninguna tarjeta registrada') + '\n\n_Usa por ejemplo: `no pagué bbva` o `no pagué mp`._'
      }
    }];
  }
  // Si dijo "pagué X" pero X no es tarjeta de Fides (ej. "pagué 450 luz" o "pagué comida 120"):
  // No rechazar. Continúa hacia abajo al flujo estándar de registro de gasto variable.
}

// -------------------------------------------------------------------------
// COMANDO: "estado [alias] [monto] [fecha]"
// -------------------------------------------------------------------------
const estadoMatch = rawText.match(/^estado\b\s*(.*)$/i);
if (estadoMatch) {
  const rest = (estadoMatch[1] || '').trim();
  const parts = rest.split(/\s+/);

  let esValido = true;
  let errorMsg = '';

  if (parts.length < 3) {
    esValido = false;
    errorMsg = 'Faltan parámetros requeridos.';
  } else {
    const fechaInput = parts[parts.length - 1];
    const montoRaw = parts[parts.length - 2].replace('$', '').replace(',', '.');
    const aliasInput = parts.slice(0, parts.length - 2).join(' ');

    const montoNum = parseFloat(montoRaw);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    const isDateValid = dateRegex.test(fechaInput) && !isNaN(new Date(fechaInput).getTime());
    const isMontoValid = !isNaN(montoNum) && montoNum > 0;
    const isFuture = isDateValid && (fechaInput > mxDateStr);

    if (!isMontoValid || !isDateValid || !isFuture) {
      esValido = false;
      const errores = [];
      if (!isMontoValid) errores.push('El monto debe ser mayor a 0');
      if (!isDateValid) errores.push('La fecha debe tener formato AAAA-MM-DD');
      else if (!isFuture) errores.push('La fecha debe ser futura (posterior a hoy ' + mxDateStr + ')');
      errorMsg = errores.join('\n▫️ ');
    } else {
      const card = findCard(aliasInput, fides);
      if (!card) {
        const cardsList = fides.map(c => '  ▫️ ' + c.tarjeta).join('\n');
        return [{
          json: {
            chat_id: incomingChatId,
            accion: 'solo_mensaje',
            mensaje: '❓ *Tarjeta no identificada:*\nNo encontré coincidencia para "' + aliasInput + '".\n\n📋 *Tarjetas disponibles en Fides:*\n' + (cardsList || '  ▫️ Ninguna tarjeta registrada')
          }
        }];
      }

      const msg = '🏛️ *Synaps Aerarium — Nuevo Estado de Cuenta*\n━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ *Tarjeta:* ' + card.tarjeta + '\n' +
        '💵 *Nuevo Saldo para no generar intereses:* $' + montoNum.toLocaleString('es-MX', {minimumFractionDigits: 2}) + '\n' +
        '📅 *Nueva Fecha Límite:* ' + fechaInput + '\n' +
        '🔄 *Estatus:* PENDIENTE (NO pagada)\n' +
        '━━━━━━━━━━━━━━━━━━━━\n' +
        '_Fides actualizado exitosamente. Vigilancia de vencimiento activada._';

      return [{
        json: {
          chat_id: incomingChatId,
          accion: 'update_fides',
          tarjeta: card.tarjeta,
          saldo_pago_sin_intereses: montoNum,
          fecha_limite: fechaInput,
          pagada: 'NO',
          mensaje: msg
        }
      }];
    }
  }

  if (!esValido) {
    return [{
      json: {
        chat_id: incomingChatId,
        accion: 'solo_mensaje',
        mensaje: '⚠️ *Formato incorrecto para actualizar estado de cuenta:*\n▫️ ' + errorMsg + '\n\n💡 *Formato correcto:* `estado [tarjeta] [monto] [AAAA-MM-DD]`\n*Ejemplo:* `estado bbva 4200 2026-11-26`'
      }
    }];
  }
}

// -------------------------------------------------------------------------
// COMANDO: GASTO VARIABLE O INGRESO EXTRA (FLUJO ESTÁNDAR)
// -------------------------------------------------------------------------
let tipo = 'gasto';
let monto = 0;
let concepto = '';
let categoria = 'Personales';

const isIngreso = /\b(extra|ingreso|bono|sueldo|pago recibido)\b/i.test(rawText);
if (isIngreso) {
  tipo = 'ingreso';
  categoria = 'Extra';
}

const amountRegex = /(?:\$?\s*)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\d+(?:,\d{1,2})?)/;
const amountMatch = rawText.match(amountRegex);
if (!amountMatch) {
  return [{
    json: {
      chat_id: incomingChatId,
      accion: 'solo_mensaje',
      mensaje: '❓ *Mensaje no reconocido:*\nNo detecté un monto válido.\n\n▫️ *Registrar gasto:* `gasolina 500` o `cafe 45`\n▫️ *Ver balance:* `resumen`\n▫️ *Borrar anterior:* `deshacer`\n▫️ *Ver todos:* `ayuda`'
    }
  }];
}

let clean = amountMatch[1];
if (clean.includes(',') && clean.includes('.')) {
  clean = clean.replace(/,/g, '');
} else if (clean.includes(',')) {
  if (/^\d{1,3}(?:,\d{3})+$/.test(clean)) {
    clean = clean.replace(/,/g, '');
  } else {
    clean = clean.replace(',', '.');
  }
}
monto = parseFloat(clean);
concepto = rawText.replace(amountMatch[0], '').replace(/\b(extra|gasto|compre|compré|pague|pagué|transferi|transferí|a)\b/gi, '').replace(/\s+/g, ' ').trim();

if (!concepto) {
  concepto = (tipo === 'ingreso') ? 'Ingreso Extra' : 'Gasto Varios';
}
concepto = concepto.charAt(0).toUpperCase() + concepto.slice(1);

const cLower = concepto.toLowerCase();
if (tipo === 'gasto') {
  if (/\b(prestamo|préstamo|deuda|credito|crédito)\b/.test(cLower)) {
    categoria = 'Deuda';
  } else if (/\b(wendy|despensa|super|walmart|costco|soriana|comida hogar|mandado|hogar|casa)\b/.test(cLower)) {
    categoria = 'Hogar';
  } else if (/\b(gasolina|gas|combustible|uber|didi|taxi|casetas|peaje|auto|estacionamiento)\b/.test(cLower)) {
    categoria = 'Transporte';
  } else if (/\b(farmacia|medicina|doctor|dentista|salud)\b/.test(cLower)) {
    categoria = 'Salud';
  } else if (/\b(luz|cfe|internet|telmex|totalplay|agua|renta)\b/.test(cLower)) {
    categoria = 'Servicios';
  } else {
    categoria = 'Personales';
  }
}

let bloquePresupuesto = '';

if (tipo === 'gasto') {
  let presupuestoCat = 0;
  if (categoria === 'Transporte') {
    presupuestoCat = parseFloat(parametra.find(p => p.parametro === 'presupuesto_gasolina_quincenal')?.valor || 1600);
  } else if (categoria === 'Personales') {
    presupuestoCat = parseFloat(parametra.find(p => p.parametro === 'presupuesto_personales_quincenal')?.valor || 3000);
  }

  const gastosQuincena = acta.filter(r => r.tipo === 'gasto' && r.quincena === quincenaTag);
  const gastoPrevio = gastosQuincena
    .filter(r => r.categoria === categoria)
    .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);

  const nuevoTotal = gastoPrevio + monto;

  if (presupuestoCat > 0) {
    const pct = Math.round((nuevoTotal / presupuestoCat) * 100);
    const restante = Math.max(0, presupuestoCat - nuevoTotal);
    const ritmoSugerido = Math.round(restante / diasRestantesCalc);
    const ritmoActualNuevo = Math.round(nuevoTotal / diasTranscurridos);

    let notaRitmo = '';
    // Aviso de ritmo predictivo SOLO para Personales (quitado para Gasolina)
    if (categoria === 'Personales' && diasTranscurridos >= 2 && restante > 0 && ritmoActualNuevo > ritmoSugerido) {
      const diasParaAgotar = Math.floor(restante / ritmoActualNuevo);
      if (diasParaAgotar < diasRestantes) {
        notaRitmo = '\n⚠️ *Aviso de Ritmo:* Gastando ~$' + ritmoActualNuevo + '/día se agotará en ' + diasParaAgotar + ' día(s). Modera a ~$' + ritmoSugerido + '/día.';
      }
    }

    if (pct >= 100) {
      bloquePresupuesto = '🚨 *LÍMITE REBASADO (' + pct + '%):* Consumo de $' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' de $' + presupuestoCat.toLocaleString('es-MX') + '. Excedente: $' + (nuevoTotal - presupuestoCat).toLocaleString('es-MX', {minimumFractionDigits: 2}) + '.';
    } else if (pct >= 80) {
      const sugeridoTxt = (categoria === 'Personales') ? ' (~$' + ritmoSugerido + '/día)' : '';
      bloquePresupuesto = '⚠️ *PRESUPUESTO AL ' + pct + '%:* Llevas $' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' de $' + presupuestoCat.toLocaleString('es-MX') + '. Disponible restante: $' + restante.toLocaleString('es-MX', {minimumFractionDigits: 2}) + sugeridoTxt + '.' + notaRitmo;
    } else {
      const sugeridoTxt = (categoria === 'Personales') ? ' (~$' + ritmoSugerido + '/día)' : '';
      bloquePresupuesto = '📊 *Presupuesto ' + categoria + ':* ' + pct + '% consumido ($' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' de $' + presupuestoCat.toLocaleString('es-MX') + '). Restan: $' + restante.toLocaleString('es-MX', {minimumFractionDigits: 2}) + sugeridoTxt + '.' + notaRitmo;
    }
  } else if (categoria === 'Deuda' || categoria === 'Hogar' || categoria === 'Servicios' || categoria === 'Salud') {
    bloquePresupuesto = '📌 *Registro ' + categoria + ':* Asentado en ' + categoria + '. No descuenta de tus presupuestos variables (Gasolina / Personales).';
  }
} else if (tipo === 'ingreso' && categoria === 'Extra') {
  const metaAhorro = parseFloat(parametra.find(p => p.parametro === 'meta_ahorro_mensual')?.valor || 1500);
  const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  
  // Limitar ahorro extra estrictamente al mes calendario actual
  const extrasMes = acta
    .filter(r => r.tipo === 'ingreso' && r.categoria === 'Extra' && (r.fecha || '').startsWith(currentYearMonth))
    .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);
  const nuevoAhorroExtra = extrasMes + monto;
  const pctMeta = Math.round((nuevoAhorroExtra / metaAhorro) * 100);

  bloquePresupuesto = '🎉 *Ahorro Extra del Mes (' + now.toLocaleString('es-MX', { month: 'short' }) + '):* $' + nuevoAhorroExtra.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' (' + pctMeta + '% de tu meta mensual de $' + metaAhorro.toLocaleString('es-MX') + ').';
}

let mensajeFinal = '🏛️ *Synaps Aerarium — Movimiento Asentado*\n━━━━━━━━━━━━━━━━━━━━\n' +
  '✅ *Tipo:* ' + tipo.toUpperCase() + '\n' +
  '📝 *Concepto:* ' + concepto + '\n' +
  '💰 *Monto:* $' + monto.toLocaleString('es-MX', {minimumFractionDigits: 2}) + '\n' +
  '🏷️ *Categoría:* ' + categoria + '\n' +
  '📅 *Periodo:* `' + quincenaTag + '`\n' +
  '⏱️ *Fecha:* ' + mxDateStr + ' ' + mxTimeStr + '\n';

if (bloquePresupuesto) {
  mensajeFinal += '━━━━━━━━━━━━━━━━━━━━\n' + bloquePresupuesto + '\n';
}
mensajeFinal += '━━━━━━━━━━━━━━━━━━━━\n_Tabula Financia actualizada en tiempo real._';

return [{
  json: {
    chat_id: incomingChatId,
    accion: 'append_acta',
    fecha: mxDateStr + ' ' + mxTimeStr,
    tipo: tipo,
    concepto: concepto,
    monto: monto,
    categoria: categoria,
    quincena: quincenaTag,
    origen: 'telegram',
    mensaje: mensajeFinal
  }
}];
