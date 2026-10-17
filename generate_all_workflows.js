const fs = require('fs');
const path = require('path');

const SHEET_ID = '1AWIYHlirCr9lt0at2JwwtsugVAYXLl7Ga2tQxDR6K1Q';

// =========================================================================
// 1. WORKFLOW: synaps_captura_gasto.json (con Control de Presupuestos)
// =========================================================================
const jsCodeCaptura = `// 1. Validar seguridad dinámica con telegram_chat_id de Parametra
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

// Identificador de quincena
let quincenaTag = '';
if (currentDay >= 14 && currentDay <= 29) {
  quincenaTag = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-Q1';
} else if (currentDay >= 30) {
  quincenaTag = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-Q2';
} else {
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }
  quincenaTag = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-Q2';
}

// 2. Parseo inteligente de texto
let tipo = 'gasto';
let monto = 0;
let concepto = '';
let categoria = 'Personales';

const isIngreso = /\\b(extra|ingreso|bono|sueldo|pago recibido)\\b/i.test(rawText);
if (isIngreso) {
  tipo = 'ingreso';
  categoria = 'Extra';
}

const amountMatch = rawText.match(/\\$?(\\d+([.,]\\d{1,2})?)/);
if (amountMatch) {
  monto = parseFloat(amountMatch[1].replace(',', '.'));
}

concepto = rawText.replace(/\\$?(\\d+([.,]\\d{1,2})?)/, '').replace(/\\b(extra|gasto|compre|pague)\\b/gi, '').trim();
if (!concepto) {
  concepto = (tipo === 'ingreso') ? 'Ingreso Extra' : 'Gasto Varios';
}
concepto = concepto.charAt(0).toUpperCase() + concepto.slice(1);

const cLower = concepto.toLowerCase();
if (tipo === 'gasto') {
  if (/gasolina|gas|uber|didi|taxi|casetas|peaje|auto|estacionamiento/.test(cLower)) {
    categoria = 'Transporte';
  } else if (/despensa|super|walmart|costco|soriana|comida hogar|mandado/.test(cLower)) {
    categoria = 'Hogar';
  } else if (/farmacia|medicina|doctor|dentista|salud/.test(cLower)) {
    categoria = 'Salud';
  } else if (/luz|cfe|internet|telmex|totalplay|agua|renta/.test(cLower)) {
    categoria = 'Servicios';
  } else {
    categoria = 'Personales';
  }
}

// 3. Calculo de Presupuestos y Control Financiero
const acta = $('Leer Acta (Movimientos)').all().map(i => i.json).filter(j => j && j.tipo);

let bloquePresupuesto = '';

if (tipo === 'gasto') {
  let presupuestoCat = 0;
  if (categoria === 'Transporte') {
    presupuestoCat = parseFloat(parametra.find(p => p.parametro === 'presupuesto_gasolina_quincenal')?.valor || 1600);
  } else if (categoria === 'Personales') {
    presupuestoCat = parseFloat(parametra.find(p => p.parametro === 'presupuesto_personales_quincenal')?.valor || 3000);
  }

  // Sumar gastos acumulados de la quincena actual en esta categoria
  const gastosQuincena = acta.filter(r => r.tipo === 'gasto' && r.quincena === quincenaTag);
  const gastoPrevio = gastosQuincena
    .filter(r => r.categoria === categoria)
    .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);

  const nuevoTotal = gastoPrevio + monto;

  if (presupuestoCat > 0) {
    const pct = Math.round((nuevoTotal / presupuestoCat) * 100);
    const restante = Math.max(0, presupuestoCat - nuevoTotal);
    if (pct >= 100) {
      bloquePresupuesto = '🚨 *LÍMITE REBASADO (' + pct + '%):* Consumo de $' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' de $' + presupuestoCat.toLocaleString('es-MX') + '. Excedente: $' + (nuevoTotal - presupuestoCat).toLocaleString('es-MX', {minimumFractionDigits: 2}) + '.';
    } else if (pct >= 80) {
      bloquePresupuesto = '⚠️ *PRESUPUESTO AL ' + pct + '%:* Llevas $' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' de $' + presupuestoCat.toLocaleString('es-MX') + '. Disponible restante: $' + restante.toLocaleString('es-MX', {minimumFractionDigits: 2}) + '.';
    } else {
      bloquePresupuesto = '📊 *Presupuesto ' + categoria + ':* ' + pct + '% consumido ($' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' de $' + presupuestoCat.toLocaleString('es-MX') + '). Restan: $' + restante.toLocaleString('es-MX', {minimumFractionDigits: 2}) + '.';
    }
  }
} else if (tipo === 'ingreso' && categoria === 'Extra') {
  const metaAhorro = parseFloat(parametra.find(p => p.parametro === 'meta_ahorro_mensual')?.valor || 1500);
  const extrasMes = acta
    .filter(r => r.tipo === 'ingreso' && r.categoria === 'Extra')
    .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);
  const nuevoAhorroExtra = extrasMes + monto;
  const pctMeta = Math.round((nuevoAhorroExtra / metaAhorro) * 100);

  bloquePresupuesto = '🎉 *Ahorro Extra del Mes:* $' + nuevoAhorroExtra.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' (' + pctMeta + '% de tu meta de ahorro mensual de $' + metaAhorro.toLocaleString('es-MX') + ').';
}

// 4. Mensaje consolidado de confirmacion
let mensajeFinal = "🏛️ *Synaps Aerarium — Movimiento Asentado*\\n━━━━━━━━━━━━━━━━━━━━\\n" +
  "✅ *Tipo:* " + tipo.toUpperCase() + "\\n" +
  "📝 *Concepto:* " + concepto + "\\n" +
  "💰 *Monto:* $" + monto.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "\\n" +
  "🏷️ *Categoría:* " + categoria + "\\n" +
  "📅 *Periodo:* \`" + quincenaTag + "\`\\n" +
  "⏱️ *Fecha:* " + mxDateStr + " " + mxTimeStr + "\\n";

if (bloquePresupuesto) {
  mensajeFinal += "━━━━━━━━━━━━━━━━━━━━\\n" + bloquePresupuesto + "\\n";
}
mensajeFinal += "━━━━━━━━━━━━━━━━━━━━\\n_Tabula Financia actualizada en tiempo real._";

return [{
  json: {
    chat_id: incomingChatId,
    fecha: mxDateStr + ' ' + mxTimeStr,
    tipo: tipo,
    concepto: concepto,
    monto: monto,
    categoria: categoria,
    quincena: quincenaTag,
    origen: 'telegram',
    mensaje: mensajeFinal
  }
}];`;

const workflowCaptura = {
  "name": "Synaps - Captura de Gastos (Aerarium)",
  "nodes": [
    {
      "parameters": {
        "updates": [
          "message"
        ],
        "additionalFields": {}
      },
      "id": "node-telegram-trigger",
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "typeVersion": 1.1,
      "position": [120, 300]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Parametra",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-parametra-captura",
      "name": "Leer Parametra",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [320, 300]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Acta",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-acta-captura",
      "name": "Leer Acta (Movimientos)",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [520, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": jsCodeCaptura
      },
      "executeOnce": true,
      "id": "node-vertex-parser",
      "name": "Vertex Parser & Financial Engine",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [740, 300]
    },
    {
      "parameters": {
        "operation": "append",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Acta",
          "mode": "name"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "fecha": "={{ $json.fecha }}",
            "tipo": "={{ $json.tipo }}",
            "concepto": "={{ $json.concepto }}",
            "monto": "={{ $json.monto }}",
            "categoria": "={{ $json.categoria }}",
            "quincena": "={{ $json.quincena }}",
            "origen": "={{ $json.origen }}"
          }
        },
        "options": {}
      },
      "id": "node-google-sheets-append",
      "name": "Registrar en Acta (Sheets)",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [960, 300]
    },
    {
      "parameters": {
        "chatId": "={{ $('Vertex Parser & Financial Engine').first().json.chat_id }}",
        "text": "={{ $('Vertex Parser & Financial Engine').first().json.mensaje }}",
        "additionalFields": {
          "parse_mode": "Markdown"
        }
      },
      "id": "node-telegram-reply",
      "name": "Confirmar por Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1180, 300]
    }
  ],
  "connections": {
    "Telegram Trigger": {
      "main": [
        [
          {
            "node": "Leer Parametra",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Parametra": {
      "main": [
        [
          {
            "node": "Leer Acta (Movimientos)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Acta (Movimientos)": {
      "main": [
        [
          {
            "node": "Vertex Parser & Financial Engine",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Vertex Parser & Financial Engine": {
      "main": [
        [
          {
            "node": "Registrar en Acta (Sheets)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Registrar en Acta (Sheets)": {
      "main": [
        [
          {
            "node": "Confirmar por Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
};

// =========================================================================
// 2. WORKFLOW: synaps_heartbeat.json (Hora CDMX corregida)
// =========================================================================
const jsCodeHeartbeat = `const parametra = $('Leer Parametra').all().map(i => i.json).filter(j => j && j.parametro);
const monitiones = $('Leer Monitiones').all().map(i => i.json).filter(j => j && j.id_alerta);

const chatIdConfig = parametra.find(p => p.parametro === 'telegram_chat_id')?.valor || '';

// Hora CDMX estricta
const now = new Date();
const nowStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }) + ' ' + now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' });

let ultimaAlertaStr = 'Sin alertas registradas aún';
if (monitiones.length > 0) {
  const ultima = monitiones[monitiones.length - 1];
  ultimaAlertaStr = (ultima.fecha_envio || 'N/A') + ' (ID: ' + (ultima.id_alerta || 'N/A') + ')';
}

const mensajeTelegram = "💓 *Synaps Aerarium — Heartbeat Semanal*\\n━━━━━━━━━━━━━━━━━━━━\\n" +
  "✅ *Estado:* Sistema vivo y operando.\\n" +
  "🕒 *Pulso:* " + nowStr + "\\n" +
  "📡 *Última alerta en Monitiones:*\\n_" + ultimaAlertaStr + "_\\n" +
  "━━━━━━━━━━━━━━━━━━━━\\n_Oracle Cloud + n8n + Aerarium 100% operativos._";

return [{
  json: {
    chat_id: chatIdConfig,
    mensaje: mensajeTelegram
  }
}];`;

const workflowHeartbeat = {
  "name": "Synaps - Heartbeat (Aerarium)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 9 * * 1"
            }
          ]
        }
      },
      "id": "node-heartbeat-schedule",
      "name": "Cron Lunes 9:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [160, 300]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Parametra",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-parametra-hb",
      "name": "Leer Parametra",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [380, 300]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Monitiones",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-monitiones-hb",
      "name": "Leer Monitiones",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [600, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": jsCodeHeartbeat
      },
      "executeOnce": true,
      "id": "node-prep-heartbeat",
      "name": "Preparar Heartbeat",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [820, 300]
    },
    {
      "parameters": {
        "chatId": "={{ $json.chat_id }}",
        "text": "={{ $json.mensaje }}",
        "additionalFields": {
          "parse_mode": "Markdown"
        }
      },
      "id": "node-telegram-hb-send",
      "name": "Despachar Heartbeat Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1040, 300]
    }
  ],
  "connections": {
    "Cron Lunes 9:00 AM": {
      "main": [
        [
          {
            "node": "Leer Parametra",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Parametra": {
      "main": [
        [
          {
            "node": "Leer Monitiones",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Monitiones": {
      "main": [
        [
          {
            "node": "Preparar Heartbeat",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar Heartbeat": {
      "main": [
        [
          {
            "node": "Despachar Heartbeat Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
};

// =========================================================================
// 3. WORKFLOW: synaps_resumen_quincena.json (Sección 4.2 y Flujo 2)
// =========================================================================
const jsCodeResumen = `// Solo ejecutar en días de pago de quincena (14 o 30 / último día de mes)
const now = new Date();
const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const [y, m, d] = todayStr.split('-').map(Number);
const daysInMonth = new Date(y, m, 0).getDate();

const isPayDay14 = (d === 14);
const isPayDay30 = (d === Math.min(30, daysInMonth));

if (!isPayDay14 && !isPayDay30) {
  return []; // No es día de inicio de quincena
}

const qLabel = isPayDay14 ? 'Q1' : 'Q2';
const quincenaTag = y + '-' + String(m).padStart(2, '0') + '-' + qLabel;

const parametra = $('Leer Parametra').all().map(i => i.json).filter(j => j && j.parametro);
const vectigalia = $('Leer Vectigalia').all().map(i => i.json).filter(j => j && j.id && j.activo === 'SI');
const acta = $('Leer Acta (Movimientos)').all().map(i => i.json).filter(j => j && j.tipo);

const chatId = parametra.find(p => p.parametro === 'telegram_chat_id')?.valor || '';
const ingresoEsperado = parseFloat(parametra.find(p => p.parametro === 'ingreso_quincenal_promedio')?.valor || 22200);
const pGasolina = parseFloat(parametra.find(p => p.parametro === 'presupuesto_gasolina_quincenal')?.valor || 1600);
const pPersonales = parseFloat(parametra.find(p => p.parametro === 'presupuesto_personales_quincenal')?.valor || 3000);
const presupuestoVariableTotal = pGasolina + pPersonales;
const umbralMargenMin = parseFloat(parametra.find(p => p.parametro === 'umbral_margen_minimo')?.valor || 1500);

// Calcular compromisos fijos que caen en esta ventana quincenal
// Ventana Q1: del 14 al 29.
// Ventana Q2: del 30 al 13 del siguiente mes.
const compromisosVentana = [];
let totalFijosQuincena = 0;

for (const item of vectigalia) {
  if (item.tipo !== 'gasto') continue;
  const rawDias = String(item.dia || '').split(',').map(s => s.trim().toLowerCase());
  const monto = parseFloat(item.monto || 0);

  for (const rawD of rawDias) {
    if (!rawD) continue;
    let diaNum = (rawD === 'ultimo') ? daysInMonth : parseInt(rawD);
    if (isNaN(diaNum)) continue;

    let caeEnVentana = false;
    if (isPayDay14) {
      caeEnVentana = (diaNum >= 14 && diaNum <= 29);
    } else {
      caeEnVentana = (diaNum >= 30 || diaNum <= 13);
    }

    if (caeEnVentana) {
      compromisosVentana.push({
        concepto: item.concepto,
        dia: diaNum,
        monto: monto
      });
      totalFijosQuincena += monto;
    }
  }
}

// Margen proyectado de maniobra
const margenEstimado = ingresoEsperado - totalFijosQuincena - presupuestoVariableTotal;

let alertaMargen = '';
if (margenEstimado < umbralMargenMin) {
  alertaMargen = '⚠️ *ALERTA MARGEN BAJO:* Margen proyectado de $' + margenEstimado.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' está por debajo del umbral mínimo de $' + umbralMargenMin.toLocaleString('es-MX') + '. Revisa o modera tu gasto variable.';
} else {
  alertaMargen = '🟢 *Margen Saludable:* Tienes margen libre estimado de $' + margenEstimado.toLocaleString('es-MX', {minimumFractionDigits: 2}) + ' para contingencias o ahorro extra.';
}

const listaCompromisosStr = compromisosVentana.map(c => '  ▫️ ' + c.concepto + ' (día ' + c.dia + '): $' + c.monto.toLocaleString('es-MX', {minimumFractionDigits: 2})).join('\\n');

const mensaje = "🏛️ *Synaps Aerarium — Balance de Quincena (" + qLabel + ")*\\n━━━━━━━━━━━━━━━━━━━━\\n" +
  "📅 *Periodo:* \`" + quincenaTag + "\`\\n" +
  "💵 *Ingreso Esperado:* $" + ingresoEsperado.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "\\n\\n" +
  "📌 *Compromisos Fijos de la Quincena ($" + totalFijosQuincena.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "):*\\n" +
  (listaCompromisosStr || '  ▫️ Sin compromisos fijos en esta ventana') + "\\n\\n" +
  "🛒 *Presupuestos Variables Apartados:* $" + presupuestoVariableTotal.toLocaleString('es-MX', {minimumFractionDigits: 2}) + "\\n" +
  "  ▫️ Gasolina: $" + pGasolina.toLocaleString('es-MX') + "\\n" +
  "  ▫️ Personales: $" + pPersonales.toLocaleString('es-MX') + "\\n\\n" +
  "━━━━━━━━━━━━━━━━━━━━\\n" +
  "💰 *MARGEN ESTIMADO DE MANIOBRA:*\\n👉 *$" + margenEstimado.toLocaleString('es-MX', {minimumFractionDigits: 2}) + " MXN*\\n\\n" +
  alertaMargen + "\\n━━━━━━━━━━━━━━━━━━━━\\n_Tabula Financia — Resumen Quincenal._";

return [{
  json: {
    chat_id: chatId,
    quincena: quincenaTag,
    ingreso: ingresoEsperado,
    fijos: totalFijosQuincena,
    variables: presupuestoVariableTotal,
    margen: margenEstimado,
    mensaje: mensaje
  }
}];`;

const workflowResumen = {
  "name": "Synaps - Resumen de Quincena (Aerarium)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 8 14,28,29,30 * *"
            }
          ]
        }
      },
      "id": "node-resumen-schedule",
      "name": "Cron Días de Pago 8:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [100, 280]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Parametra",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-parametra-resumen",
      "name": "Leer Parametra",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [300, 280]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Vectigalia",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-vectigalia-resumen",
      "name": "Leer Vectigalia",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [500, 280]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": SHEET_ID,
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Acta",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-acta-resumen",
      "name": "Leer Acta (Movimientos)",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [700, 280]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": jsCodeResumen
      },
      "executeOnce": true,
      "id": "node-engine-resumen",
      "name": "Engine Resumen Quincenal",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [920, 280]
    },
    {
      "parameters": {
        "chatId": "={{ $json.chat_id }}",
        "text": "={{ $json.mensaje }}",
        "additionalFields": {
          "parse_mode": "Markdown"
        }
      },
      "id": "node-telegram-send-resumen",
      "name": "Despachar Resumen Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1140, 280]
    }
  ],
  "connections": {
    "Cron Días de Pago 8:00 AM": {
      "main": [
        [
          {
            "node": "Leer Parametra",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Parametra": {
      "main": [
        [
          {
            "node": "Leer Vectigalia",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Vectigalia": {
      "main": [
        [
          {
            "node": "Leer Acta (Movimientos)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Acta (Movimientos)": {
      "main": [
        [
          {
            "node": "Engine Resumen Quincenal",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Engine Resumen Quincenal": {
      "main": [
        [
          {
            "node": "Despachar Resumen Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
};

fs.writeFileSync(path.join(__dirname, 'synaps_captura_gasto.json'), JSON.stringify(workflowCaptura, null, 2), 'utf8');
fs.writeFileSync(path.join(__dirname, 'synaps_heartbeat.json'), JSON.stringify(workflowHeartbeat, null, 2), 'utf8');
fs.writeFileSync(path.join(__dirname, 'synaps_resumen_quincena.json'), JSON.stringify(workflowResumen, null, 2), 'utf8');

console.log('Archivos actualizados exitosamente: synaps_captura_gasto.json, synaps_heartbeat.json, synaps_resumen_quincena.json');
