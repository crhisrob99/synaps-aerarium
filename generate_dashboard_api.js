const fs = require('fs');

const workflow = {
  "name": "Synaps - API Dashboard (Aerarium)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "GET",
        "path": "aerarium-data",
        "responseMode": "responseNode",
        "options": {
          "responseHeaders": {
            "entries": [
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              },
              {
                "name": "Access-Control-Allow-Methods",
                "value": "GET,OPTIONS"
              },
              {
                "name": "Access-Control-Allow-Headers",
                "value": "Content-Type,Authorization"
              }
            ]
          }
        }
      },
      "id": "node-webhook-dashboard",
      "name": "Webhook Aerarium Data",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        160,
        300
      ],
      "webhookId": "aerarium-data"
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": "1AWIYHlirCr9lt0at2JwwtsugVAYXLl7Ga2tQxDR6K1Q",
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
      "id": "node-read-parametra-dash",
      "name": "Leer Parametra",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        380,
        300
      ]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": "1AWIYHlirCr9lt0at2JwwtsugVAYXLl7Ga2tQxDR6K1Q",
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
      "id": "node-read-vectigalia-dash",
      "name": "Leer Vectigalia",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        580,
        300
      ]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": "1AWIYHlirCr9lt0at2JwwtsugVAYXLl7Ga2tQxDR6K1Q",
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Fides",
          "mode": "name"
        },
        "options": {}
      },
      "alwaysOutputData": true,
      "executeOnce": true,
      "id": "node-read-fides-dash",
      "name": "Leer Fides (Tarjetas)",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        780,
        300
      ]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": "1AWIYHlirCr9lt0at2JwwtsugVAYXLl7Ga2tQxDR6K1Q",
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
      "id": "node-read-acta-dash",
      "name": "Leer Acta (Movimientos)",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        980,
        300
      ]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "jsCode": `// =========================================================================
// SYNAPS AERARIUM — GENERADOR DE PAYLOAD PARA DASHBOARD PWA
// =========================================================================

const parametra = $('Leer Parametra').all().map(i => i.json).filter(j => j && j.parametro);
const vectigalia = $('Leer Vectigalia').all().map(i => i.json).filter(j => j && j.id && j.activo === 'SI');
const fides = $('Leer Fides (Tarjetas)').all().map(i => i.json).filter(j => j && j.tarjeta);
const acta = $('Leer Acta (Movimientos)').all().map(i => i.json).filter(j => j && j.tipo);

// Fecha actual en America/Mexico_City
const now = new Date();
const mxDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const mxTimeStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });
const [year, monthStr, dayStr] = mxDateStr.split('-');
const currentYear = parseInt(year);
const currentMonth = parseInt(monthStr);
const currentDay = parseInt(dayStr);
const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

// Identificar quincena
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

// Dias totales y transcurridos
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

// Presupuestos base
const pGasolina = parseFloat(parametra.find(p => p.parametro === 'presupuesto_gasolina_quincenal')?.valor || 1600);
const pPersonales = parseFloat(parametra.find(p => p.parametro === 'presupuesto_personales_quincenal')?.valor || 3000);
const sueldoEsperado = parseFloat(parametra.find(p => p.parametro === 'ingreso_quincenal_promedio')?.valor || 22200);
const umbralMargenMin = parseFloat(parametra.find(p => p.parametro === 'umbral_margen_minimo')?.valor || 1500);

// Gastos e ingresos de la quincena actual en Acta
const actaQuincena = acta.filter(r => r.quincena === quincenaTag);
const gGas = actaQuincena.filter(r => r.tipo === 'gasto' && r.categoria === 'Transporte').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
const gPer = actaQuincena.filter(r => r.tipo === 'gasto' && r.categoria === 'Personales').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
const gOtrosVar = actaQuincena.filter(r => r.tipo === 'gasto' && r.categoria !== 'Transporte' && r.categoria !== 'Personales').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
const totalVarConsumido = gGas + gPer + gOtrosVar;

const ingresosExtras = actaQuincena.filter(r => r.tipo === 'ingreso' && r.concepto !== 'Sueldo Quincenal').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
const totalIngresos = sueldoEsperado + ingresosExtras;

// Compromisos fijos de la quincena en Vectigalia
let compromisosFijosTotal = 0;
const compromisosLista = [];

for (const item of vectigalia) {
  if (item.tipo !== 'gasto') continue;
  const monto = parseFloat(item.monto || 0);
  const rawDias = String(item.dia || '').split(',').map(s => s.trim().toLowerCase());
  
  let caeEnEstaQuincena = false;
  for (const rd of rawDias) {
    let dNum = (rd === 'ultimo') ? daysInMonth : parseInt(rd);
    if (isNaN(dNum)) continue;
    if (isQ1 && dNum >= 14 && dNum <= 29) {
      caeEnEstaQuincena = true;
    } else if (!isQ1 && (dNum >= 30 || dNum <= 13)) {
      caeEnEstaQuincena = true;
    }
  }

  if (caeEnEstaQuincena) {
    compromisosFijosTotal += monto;
  }

  compromisosLista.push({
    id: item.id,
    concepto: item.concepto,
    monto: monto,
    frecuencia: item.frecuencia,
    dia: item.dia,
    categoria: item.categoria,
    cuenta: item.cuenta,
    es_deuda: item.es_deuda === 'SI',
    cae_en_quincena_actual: caeEnEstaQuincena
  });
}

// Margen real proyectado
const margenProyectado = totalIngresos - compromisosFijosTotal - totalVarConsumido;
const margenDisponible = Math.round(margenProyectado * 100) / 100;
const estadoMargen = margenDisponible < umbralMargenMin ? 'ALERTA_BAJO' : 'SALUDABLE';

// Burn rate Gasolina
const dispGas = Math.max(0, pGasolina - gGas);
const ritmoGasSugerido = Math.round(dispGas / diasRestantesCalc);
const ritmoGasActual = Math.round(gGas / diasTranscurridos);
const pctGas = Math.round((gGas / pGasolina) * 100);

// Burn rate Personales
const dispPer = Math.max(0, pPersonales - gPer);
const ritmoPerSugerido = Math.round(dispPer / diasRestantesCalc);
const ritmoPerActual = Math.round(gPer / diasTranscurridos);
const pctPer = Math.round((gPer / pPersonales) * 100);

// Tarjetas Fides con cálculo de días restantes
const hoyDate = new Date(currentYear, currentMonth - 1, currentDay);
const tarjetasFides = fides.map(c => {
  const saldo = parseFloat(c.saldo_pago_sin_intereses || 0);
  let diffDays = null;
  if (c.fecha_limite) {
    const [cy, cm, cd] = c.fecha_limite.split('-').map(Number);
    const flDate = new Date(cy, cm - 1, cd);
    diffDays = Math.round((flDate - hoyDate) / (1000 * 60 * 60 * 24));
  }
  return {
    tarjeta: c.tarjeta,
    saldo: saldo,
    fecha_limite: c.fecha_limite,
    pagada: c.pagada === 'SI',
    dias_restantes: diffDays
  };
});

// Últimos 20 movimientos de Acta
const ultimosMovimientos = acta.slice(-20).reverse().map(r => ({
  fecha: r.fecha,
  tipo: r.tipo,
  concepto: r.concepto,
  monto: parseFloat(r.monto || 0),
  categoria: r.categoria,
  quincena: r.quincena,
  origen: r.origen
}));

return [{
  json: {
    status: 'success',
    timestamp: mxDateStr + ' ' + mxTimeStr,
    quincena: {
      tag: quincenaTag,
      is_q1: isQ1,
      dias_totales: diasTotales,
      dias_transcurridos: diasTranscurridos,
      dias_restantes: diasRestantes,
      porcentaje_tiempo: Math.round((diasTranscurridos / diasTotales) * 100)
    },
    resumen_financiero: {
      ingreso_esperado: sueldoEsperado,
      ingresos_extras: ingresosExtras,
      total_ingresos: totalIngresos,
      compromisos_fijos_quincena: compromisosFijosTotal,
      presupuesto_variable_total: pGasolina + pPersonales,
      gasto_variable_consumido: totalVarConsumido,
      margen_proyectado: margenDisponible,
      estado_margen: estadoMargen
    },
    presupuestos_variables: {
      gasolina: {
        presupuesto: pGasolina,
        consumido: gGas,
        disponible: dispGas,
        porcentaje: pctGas,
        ritmo_actual: ritmoGasActual,
        ritmo_sugerido: ritmoGasSugerido,
        alerta_agotamiento: diasTranscurridos >= 2 && ritmoGasActual > ritmoGasSugerido && dispGas > 0
      },
      personales: {
        presupuesto: pPersonales,
        consumido: gPer,
        disponible: dispPer,
        porcentaje: pctPer,
        ritmo_actual: ritmoPerActual,
        ritmo_sugerido: ritmoPerSugerido,
        alerta_agotamiento: diasTranscurridos >= 2 && ritmoPerActual > ritmoPerSugerido && dispPer > 0
      }
    },
    tarjetas_fides: tarjetasFides,
    compromisos_vectigalia: compromisosLista,
    ultimos_movimientos: ultimosMovimientos
  }
}];`
      },
      "executeOnce": true,
      "id": "node-prep-dashboard-payload",
      "name": "Generar Payload Dashboard",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1180,
        300
      ]
    },
    {
      "parameters": {
        "respondWith": "firstIncomingItem",
        "options": {
          "responseCode": 200,
          "responseHeaders": {
            "entries": [
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              },
              {
                "name": "Access-Control-Allow-Methods",
                "value": "GET,OPTIONS,POST"
              },
              {
                "name": "Access-Control-Allow-Headers",
                "value": "*"
              }
            ]
          }
        }
      },
      "id": "node-respond-webhook",
      "name": "Responder JSON Dashboard",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        1400,
        300
      ]
    }
  ],
  "connections": {
    "Webhook Aerarium Data": {
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
            "node": "Leer Fides (Tarjetas)",
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
            "node": "Generar Payload Dashboard",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Generar Payload Dashboard": {
      "main": [
        [
          {
            "node": "Responder JSON Dashboard",
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

fs.writeFileSync('synaps_dashboard_api.json', JSON.stringify(workflow, null, 2), 'utf8');
console.log('synaps_dashboard_api.json creado con éxito');
