const XLSX = require('xlsx');

// Cargar datos
const wb = XLSX.readFile('Aerarium - Tabula Financia.xlsx');
let vectigalia = XLSX.utils.sheet_to_json(wb.Sheets['Vectigalia']);
const fides = XLSX.utils.sheet_to_json(wb.Sheets['Fides']);

// Corregir aviso_dias del auto a 2 si tenia 3
vectigalia = vectigalia.map(item => {
  if (item.id === 'gasto_auto') {
    return { ...item, aviso_dias: 2 }; // Corregido a 2 dias
  }
  return item;
});

function runEngineV2({ fecha_hoy = null, monitionesPrevias = [] }) {
  let y, m, d, todayStr;
  let es_simulacion = false;

  if (fecha_hoy) {
    es_simulacion = true;
    todayStr = fecha_hoy;
    [y, m, d] = todayStr.split('-').map(Number);
  } else {
    const now = new Date();
    todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    [y, m, d] = todayStr.split('-').map(Number);
  }

  const enviadasSet = new Set(monitionesPrevias);
  const alertasCandidatas = [];

  const daysInMonth = new Date(y, m, 0).getDate();
  const fechaHoyDate = new Date(y, m - 1, d);

  // 1. Quincena de Sueldo (14 y 30 / fin de mes)
  const isPayDay14 = (d === 14);
  const isPayDay30 = (d === Math.min(30, daysInMonth));

  if (isPayDay14 || isPayDay30) {
    const qLabel = isPayDay14 ? 'Q1' : 'Q2';
    alertasCandidatas.push({
      id_alerta: `quincena_${todayStr}_${qLabel}_ingreso`,
      tipo: 'INGRESO',
      concepto: 'Sueldo',
      mensaje: `🎉 *Hoy cae quincena esperada:* ~$22,200 MXN (${qLabel}). Recuerda verificar abonos en cuenta.`
    });
  }

  // 2. Compromisos en Vectigalia
  for (const item of vectigalia) {
    if (item.activo !== 'SI' || item.tipo !== 'gasto') continue;

    const avisoDias = parseInt(item.aviso_dias || 0);
    const monto = parseFloat(item.monto || 0);
    const frecuencia = (item.frecuencia || 'mensual').toLowerCase();

    // Regla de Fin de Deuda: 30 dias antes de fecha_fin
    if (item.es_deuda === 'SI' && item.fecha_fin) {
      const [fy, fm, fd] = item.fecha_fin.split('-').map(Number);
      const fechaFinDate = new Date(fy, fm - 1, fd);
      const diffFin = Math.round((fechaFinDate - fechaHoyDate) / (1000 * 60 * 60 * 24));
      if (diffFin === 30) {
        alertasCandidatas.push({
          id_alerta: `${item.id}_${item.fecha_fin}_fin_deuda_30d`,
          tipo: 'FIN_DEUDA',
          concepto: item.concepto,
          mensaje: `🎊 *Próximo fin de deuda:* Última mensualidad de ${item.concepto} en 30 días (${item.fecha_fin}).`
        });
      }
    }

    // Parsear dias: '14,30', '1', 'ultimo'
    const rawDias = String(item.dia || '').split(',').map(s => s.trim().toLowerCase());

    for (const rawD of rawDias) {
      if (!rawD) continue;

      let diaTarget = 0;
      if (rawD === 'ultimo') {
        diaTarget = daysInMonth;
      } else {
        const parsed = parseInt(rawD);
        if (isNaN(parsed)) continue;
        diaTarget = Math.min(parsed, daysInMonth);
      }

      // Evaluar ocurrencias posibles: mes actual y mes siguiente (para avisos que cruzan fin de mes)
      const ocurrencias = [
        { year: y, month: m, day: diaTarget }
      ];

      // Si estamos en la segunda mitad del mes (d >= 15) y diaTarget es a inicios del mes (<= 10), evaluar mes siguiente
      if (d >= 15 && diaTarget <= 10) {
        const nextY = (m === 12) ? y + 1 : y;
        const nextM = (m === 12) ? 1 : m + 1;
        const daysInNextM = new Date(nextY, nextM, 0).getDate();
        ocurrencias.push({
          year: nextY,
          month: nextM,
          day: Math.min(diaTarget, daysInNextM)
        });
      }

      for (const oc of ocurrencias) {
        const fechaOcurrenciaDate = new Date(oc.year, oc.month - 1, oc.day);
        const fechaOcurrenciaStr = `${oc.year}-${String(oc.month).padStart(2, '0')}-${String(oc.day).padStart(2, '0')}`;

        // Validar Vigencia [fecha_inicio, fecha_fin]
        if (item.fecha_inicio) {
          const [iy, im, id] = item.fecha_inicio.split('-').map(Number);
          const fechaInicioDate = new Date(iy, im - 1, id);
          if (fechaOcurrenciaDate < fechaInicioDate) continue; // Aun no inicia
        }
        if (item.fecha_fin) {
          const [fy, fm, fd] = item.fecha_fin.split('-').map(Number);
          const fechaFinDate = new Date(fy, fm - 1, fd);
          if (fechaOcurrenciaDate > fechaFinDate) continue; // Ya vencio
        }

        // Validar Frecuencia Bimestral
        if (frecuencia === 'bimestral') {
          const mesInicio = parseInt(item.mes_inicio || 1);
          let anioInicio = y;
          if (item.fecha_inicio) {
            anioInicio = parseInt(item.fecha_inicio.split('-')[0]);
          }
          const deltaMeses = (oc.year - anioInicio) * 12 + (oc.month - mesInicio);
          if (deltaMeses < 0 || (deltaMeses % 2 !== 0)) {
            continue; // No corresponde a este bimestre
          }
        }

        const diffDays = Math.round((fechaOcurrenciaDate - fechaHoyDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          alertasCandidatas.push({
            id_alerta: `${item.id}_${fechaOcurrenciaStr}_hoy`,
            tipo: 'PAGO_HOY',
            concepto: item.concepto,
            mensaje: `⚠️ *Hoy vence compromiso:* ${item.concepto} por $${monto.toLocaleString('es-MX', {minimumFractionDigits: 2})} (${item.cuenta || 'Débito'})`
          });
        } else if (diffDays === avisoDias && avisoDias > 0) {
          alertasCandidatas.push({
            id_alerta: `${item.id}_${fechaOcurrenciaStr}_previo_${avisoDias}d`,
            tipo: 'AVISO_PREVIO',
            concepto: item.concepto,
            mensaje: `🔔 *Próximo pago:* ${item.concepto} por $${monto.toLocaleString('es-MX', {minimumFractionDigits: 2})} vence en ${avisoDias} día(s) (el ${oc.day}-${oc.month}).`
          });
        }
      }
    }
  }

  // 3. Tarjetas en Fides
  for (const card of fides) {
    if (card.pagada === 'SI' || !card.fecha_limite) continue;

    const saldo = parseFloat(card.saldo_pago_sin_intereses || 0);
    const [cy, cm, cd] = card.fecha_limite.split('-').map(Number);
    const fechaLimiteDate = new Date(cy, cm - 1, cd);
    const diffDays = Math.round((fechaLimiteDate - fechaHoyDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      alertasCandidatas.push({
        id_alerta: `tarjeta_${card.tarjeta}_${card.fecha_limite}_limite`,
        tipo: 'TARJETA_LIMITE',
        concepto: card.tarjeta,
        mensaje: `🚨 *¡Fecha límite HOY!* Tarjeta ${card.tarjeta}. Saldo para no generar intereses: $${saldo.toLocaleString('es-MX', {minimumFractionDigits: 2})}.`
      });
    } else if (diffDays === 3) {
      alertasCandidatas.push({
        id_alerta: `tarjeta_${card.tarjeta}_${card.fecha_limite}_3d`,
        tipo: 'TARJETA_PREVIO',
        concepto: card.tarjeta,
        mensaje: `💳 *Atención Tarjeta ${card.tarjeta}:* Saldo de $${saldo.toLocaleString('es-MX', {minimumFractionDigits: 2})} vence en 3 días (${card.fecha_limite}).`
      });
    }
  }

  // Filtrado de idempotencia
  const alertasNuevas = alertasCandidatas.filter(a => !enviadasSet.has(a.id_alerta));

  return {
    fecha_evaluada: todayStr,
    total_nuevas: alertasNuevas.length,
    alertas: alertasNuevas
  };
}

// Ejecutar pruebas solicitadas
const simulaciones = [
  '2026-10-12', // NO debe aparecer luz ni gas
  '2026-10-23', // Auto debe salir (aviso 2 dias, vence el 25)
  '2026-10-30', // Renta debe usar 2026-11-01 en el ID
  '2026-11-12', // Debe avisar luz (vence 15-11, aviso 3 dias)
  '2026-12-12', // Debe avisar gas (vence 15-12, aviso 3 dias)
  '2027-01-12', // Debe avisar luz otra vez (vence 15-01, aviso 3 dias)
  '2027-02-14', // Fin de prestamo proximo (30 dias antes del 16-mar-2027) + aviso cuota 16-feb
  '2027-03-17'  // Prestamo ya no debe aparecer (vencio 16-mar-2027)
];

console.log('=== RESULTADOS DE SIMULACION (PASOS 3 Y 4) ===\n');
for (const f of simulaciones) {
  const res = runEngineV2({ fecha_hoy: f });
  console.log(`📅 FECHA: ${f} (${res.total_nuevas} alertas)`);
  res.alertas.forEach((a, i) => {
    console.log(`  [${i + 1}] ID: ${a.id_alerta}`);
    console.log(`      Mensaje: ${a.mensaje}`);
  });
  console.log('--------------------------------------------------');
}
