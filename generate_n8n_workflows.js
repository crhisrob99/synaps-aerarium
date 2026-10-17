const fs = require('fs');
const path = require('path');

const SHEET_ID = '1AWIYHlirCr9lt0at2JwwtsugVAYXLl7Ga2tQxDR6K1Q';
const CHAT_ID = '1954772302';

// -------------------------------------------------------------
// WORKFLOW 1: CAPTURA DE GASTOS Y MOVIMIENTOS POR TELEGRAM
// -------------------------------------------------------------
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
      "position": [200, 300]
    },
    {
      "parameters": {
        "jsCode": `// 1. Validar seguridad de Chat ID
const incomingChatId = $input.item.json.message?.chat?.id?.toString() || '';
const authorizedChatId = '${CHAT_ID}';

if (incomingChatId !== authorizedChatId) {
  return []; // Ignorar mensaje no autorizado
}

const rawText = ($input.item.json.message?.text || '').trim();
if (!rawText) return [];

// Obtener fecha actual en zona horaria America/Mexico_City
const now = new Date();
const mxDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
const mxTimeStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });
const [year, monthStr, dayStr] = mxDateStr.split('-');
const currentYear = parseInt(year);
const currentMonth = parseInt(monthStr);
const currentDay = parseInt(dayStr);

// Calcular identificador de quincena segun regla:
// Quincena A = 14 al 29 -> YYYY-MM-Q1
// Quincena B = 30 al 13 del siguiente mes -> YYYY-MM-Q2
let quincenaTag = '';
if (currentDay >= 14 && currentDay <= 29) {
  quincenaTag = \`\${currentYear}-\${String(currentMonth).padStart(2, '0')}-Q1\`;
} else if (currentDay >= 30) {
  quincenaTag = \`\${currentYear}-\${String(currentMonth).padStart(2, '0')}-Q2\`;
} else {
  // Dias 1 al 13 corresponden a la Q2 del mes anterior
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }
  quincenaTag = \`\${prevYear}-\${String(prevMonth).padStart(2, '0')}-Q2\`;
}

// 2. Parseo inteligente de texto (Vertex logic)
// Admite formatos: "gasolina 800", "despensa 1250.50", "extra 1500 bono venta", "tacos 150"
let tipo = 'gasto';
let monto = 0;
let concepto = '';
let categoria = 'Personales';

// Detectar si es ingreso extra
const isIngreso = /\\b(extra|ingreso|bono|sueldo|pago recibido)\\b/i.test(rawText);
if (isIngreso) {
  tipo = 'ingreso';
  categoria = 'Extra';
}

// Extraer numeros/monto
const amountMatch = rawText.match(/\\$?(\\d+([.,]\\d{1,2})?)/);
if (amountMatch) {
  monto = parseFloat(amountMatch[1].replace(',', '.'));
}

// Extraer concepto (remover el monto)
concepto = rawText.replace(/\\$?(\\d+([.,]\\d{1,2})?)/, '').replace(/\\b(extra|gasto|compre|pague)\\b/gi, '').trim();
if (!concepto) {
  concepto = tipo === 'ingreso' ? 'Ingreso Extra' : 'Gasto Varios';
}
// Capitalizar primera letra
concepto = concepto.charAt(0).toUpperCase() + concepto.slice(1);

// Deducir categoria si es gasto
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

return [{
  json: {
    chat_id: incomingChatId,
    fecha: \`\${mxDateStr} \${mxTimeStr}\`,
    tipo: tipo,
    concepto: concepto,
    monto: monto,
    categoria: categoria,
    quincena: quincenaTag,
    origen: 'telegram'
  }
}];`
      },
      "id": "node-vertex-parser",
      "name": "Vertex Parser & Security Gate",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [420, 300]
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
      "position": [660, 300]
    },
    {
      "parameters": {
        "chatId": "={{ $('Vertex Parser & Security Gate').item.json.chat_id }}",
        "text": "=🏛️ *Synaps Aerarium — Movimiento Asentado*\n━━━━━━━━━━━━━━━━━━━━\n✅ *Tipo:* {{ $('Vertex Parser & Security Gate').item.json.tipo.toUpperCase() }}\n📝 *Concepto:* {{ $('Vertex Parser & Security Gate').item.json.concepto }}\n💰 *Monto:* ${{ $('Vertex Parser & Security Gate').item.json.monto.toLocaleString('es-MX', {minimumFractionDigits: 2}) }}\n🏷️ *Categoría:* {{ $('Vertex Parser & Security Gate').item.json.categoria }}\n📅 *Periodo:* `{{ $('Vertex Parser & Security Gate').item.json.quincena }}`\n⏱️ *Fecha:* {{ $('Vertex Parser & Security Gate').item.json.fecha }}\n━━━━━━━━━━━━━━━━━━━━\n_Datos sincronizados en Tabula Financia._",
        "additionalFields": {
          "parse_mode": "Markdown"
        }
      },
      "id": "node-telegram-reply",
      "name": "Confirmar por Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [900, 300]
    }
  ],
  "connections": {
    "Telegram Trigger": {
      "main": [
        [
          {
            "node": "Vertex Parser & Security Gate",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Vertex Parser & Security Gate": {
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

// -------------------------------------------------------------
// WORKFLOW 2: ALERTAS DIARIAS Y CONTROL PREVENTIVO
// -------------------------------------------------------------
const workflowAlertas = {
  "name": "Synaps - Alertas Diarias (Aerarium)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 8 * * *"
            }
          ]
        }
      },
      "id": "node-schedule",
      "name": "Cron Diario 8:00 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [180, 260]
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
      "id": "node-read-vectigalia",
      "name": "Leer Vectigalia",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [400, 160]
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
          "value": "Fides",
          "mode": "name"
        },
        "options": {}
      },
      "id": "node-read-fides",
      "name": "Leer Fides (Tarjetas)",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [400, 360]
    },
    {
      "parameters": {
        "jsCode": `// Evaluar alertas del dia
const vectigalia = $('Leer Vectigalia').all().map(i => i.json);
const fides = $('Leer Fides (Tarjetas)').all().map(i => i.json);

const now = new Date();
const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const [y, m, d] = todayStr.split('-').map(Number);

const alertas = [];

// 1. Verificar si hoy es dia de pago de quincena (14 o 30)
// Ajuste de febrero si aplica
const lastDayOfMonth = new Date(y, m, 0).getDate();
const isPayDay = (d === 14) || (d === 30) || (m === 2 && d === lastDayOfMonth);

if (isPayDay) {
  alertas.push({
    id_alerta: \`quincena_\${todayStr}\`,
    tipo: 'INGRESO',
    mensaje: \`🎉 *Hoy cae quincena esperada:* ~$22,200 MXN. Recuerda verificar abonos en cuenta.\`
  });
}

// 2. Evaluar compromisos en Vectigalia
for (const item of vectigalia) {
  if (item.activo !== 'SI' || item.tipo !== 'gasto') continue;
  
  const avisoDias = parseInt(item.aviso_dias || 0);
  const monto = parseFloat(item.monto || 0);
  const diaPago = parseInt(item.dia);

  if (!isNaN(diaPago)) {
    // Calcular fecha del pago en este mes
    const fechaPago = new Date(y, m - 1, diaPago);
    const fechaHoy = new Date(y, m - 1, d);
    const diffTime = fechaPago - fechaHoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      alertas.push({
        id_alerta: \`\${item.id}_\${todayStr}_hoy\`,
        tipo: 'PAGO_HOY',
        mensaje: \`⚠️ *Hoy vence compromiso:* \${item.concepto} por $\${monto.toLocaleString('es-MX')} (\${item.cuenta || 'Débito'})\`
      });
    } else if (diffDays === avisoDias && avisoDias > 0) {
      alertas.push({
        id_alerta: \`\${item.id}_\${todayStr}_previo\`,
        tipo: 'AVISO_PREVIO',
        mensaje: \`🔔 *Próximo pago:* \${item.concepto} por $\${monto.toLocaleString('es-MX')} vence en \${avisoDias} días (el \${diaPago}-\${m}).\`
      });
    }
  }
}

// 3. Evaluar tarjetas en Fides
for (const card of fides) {
  if (card.pagada === 'SI') continue;
  
  const saldo = parseFloat(card.saldo_pago_sin_intereses || 0);
  if (!card.fecha_limite) continue;
  
  const [cy, cm, cd] = card.fecha_limite.split('-').map(Number);
  const fechaLimite = new Date(cy, cm - 1, cd);
  const fechaHoy = new Date(y, m - 1, d);
  const diffDays = Math.ceil((fechaLimite - fechaHoy) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    alertas.push({
      id_alerta: \`tarjeta_\${card.tarjeta}_\${todayStr}_limite\`,
      tipo: 'TARJETA_LIMITE',
      mensaje: \`🚨 *¡Fecha límite HOY!* Tarjeta \${card.tarjeta}. Saldo para no generar intereses: $\${saldo.toLocaleString('es-MX')}.\`
    });
  } else if (diffDays > 0 && diffDays <= 3) {
    alertas.push({
      id_alerta: \`tarjeta_\${card.tarjeta}_\${todayStr}_\${diffDays}d\`,
      tipo: 'TARJETA_PREVIO',
      mensaje: \`💳 *Atención Tarjeta \${card.tarjeta}:* Saldo de $\${saldo.toLocaleString('es-MX')} vence en \${diffDays} días (\${card.fecha_limite}).\`
    });
  }
}

if (alertas.length === 0) {
  return []; // Nada que alertar hoy
}

const mensajeCompilado = "🏛️ *Synaps Aerarium — Alertas Matutinas (8:00 AM)*\\n━━━━━━━━━━━━━━━━━━━━\\n" + 
  alertas.map(a => a.mensaje).join("\\n\\n") + 
  "\\n━━━━━━━━━━━━━━━━━━━━\\n_Estado general: Tabula Financia actualizada._";

return [{
  json: {
    total_alertas: alertas.length,
    mensaje: mensajeCompilado,
    alertas: alertas
  }
}];`
      },
      "id": "node-engine-alertas",
      "name": "Engine de Alertas & Vencimientos",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [660, 260]
    },
    {
      "parameters": {
        "chatId": CHAT_ID,
        "text": "={{ $json.mensaje }}",
        "additionalFields": {
          "parse_mode": "Markdown"
        }
      },
      "id": "node-telegram-send-alert",
      "name": "Despachar Alerta Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [900, 260]
    }
  ],
  "connections": {
    "Cron Diario 8:00 AM": {
      "main": [
        [
          {
            "node": "Leer Vectigalia",
            "type": "main",
            "index": 0
          },
          {
            "node": "Leer Fides (Tarjetas)",
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
            "node": "Engine de Alertas & Vencimientos",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Leer Fides (Tarjetas)": {
      "main": [
        [
          {
            "node": "Engine de Alertas & Vencimientos",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Engine de Alertas & Vencimientos": {
      "main": [
        [
          {
            "node": "Despachar Alerta Telegram",
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
fs.writeFileSync(path.join(__dirname, 'synaps_alertas_diarias.json'), JSON.stringify(workflowAlertas, null, 2), 'utf8');

console.log('Workflows generados exitosamente.');
