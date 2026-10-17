const XLSX = require('xlsx');

const wb = XLSX.readFile('Aerarium - Tabula Financia.xlsx');
let vectigalia = XLSX.utils.sheet_to_json(wb.Sheets['Vectigalia']);
let fides = XLSX.utils.sheet_to_json(wb.Sheets['Fides']);
let parametra = XLSX.utils.sheet_to_json(wb.Sheets['Parametra']);

console.log('Fides cargado con aviso_dias:', fides);

function runEngineV3({ fecha_hoy = null, monitionesPrevias = [], autoAvisoDias = null }) {
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

  // Leer telegram_chat_id de Parametra
  const chatIdParam = parametra.find(p => p.parametro === 'telegram_chat_id')?.valor || '';

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
  for (const rawItem of vectigalia) {
    if (rawItem.activo !== 'SI' || rawItem.tipo !== 'gasto') continue;

    const item = { ...rawItem };
    if (autoAvisoDias !== null && item.id === 'gasto_auto') {
      item.aviso_dias = autoAvisoDias;
    }

    // Regla 2.a: aviso_dias de Vectigalia (por defecto 2 si esta vacio)
    const avisoDias = (item.aviso_dias !== undefined && item.aviso_dias !== '' && !isNaN(parseInt(item.aviso_dias)))
      ? parseInt(item.aviso_dias)
      : 2;

    const monto = parseFloat(item.monto || 0);
    const frecuencia = (item.frecuencia || 'mensual').toLowerCase();

    // Fin de Deuda
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

    const rawDias = String(item.dia || '').split(',').map(s => s.trim().toLowerCase());

    for (const rawD of rawDias) {
      if (!rawD) continue;

      let diaTarget = (rawD === 'ultimo') ? daysInMonth : Math.min(parseInt(rawD) || 0, daysInMonth);
      if (!diaTarget) continue;

      const ocurrencias = [{ year: y, month: m, day: diaTarget }];

      if (d >= 15 && diaTarget <= 10) {
        const nextY = (m === 12) ? y + 1 : y;
        const nextM = (m === 12) ? 1 : m + 1;
        const daysInNextM = new Date(nextY, nextM, 0).getDate();
        ocurrencias.push({ year: nextY, month: nextM, day: Math.min(diaTarget, daysInNextM) });
      }

      for (const oc of ocurrencias) {
        const fechaOcurrenciaDate = new Date(oc.year, oc.month - 1, oc.day);
        const fechaOcurrenciaStr = `${oc.year}-${String(oc.month).padStart(2, '0')}-${String(oc.day).padStart(2, '0')}`;

        if (item.fecha_inicio) {
          const [iy, im, id] = item.fecha_inicio.split('-').map(Number);
          if (fechaOcurrenciaDate < new Date(iy, im - 1, id)) continue;
        }
        if (item.fecha_fin) {
          const [fy, fm, fd] = item.fecha_fin.split('-').map(Number);
          if (fechaOcurrenciaDate > new Date(fy, fm - 1, fd)) continue;
        }

        if (frecuencia === 'bimestral') {
          const mesInicio = parseInt(item.mes_inicio || 1);
          const anioInicio = item.fecha_inicio ? parseInt(item.fecha_inicio.split('-')[0]) : y;
          const deltaMeses = (oc.year - anioInicio) * 12 + (oc.month - mesInicio);
          if (deltaMeses < 0 || (deltaMeses % 2 !== 0)) continue;
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

  // 3. Tarjetas en Fides con aviso_dias configurable por tarjeta (default 2)
  for (const card of fides) {
    if (card.pagada === 'SI' || !card.fecha_limite) continue;

    const saldo = parseFloat(card.saldo_pago_sin_intereses || 0);
    const [cy, cm, cd] = card.fecha_limite.split('-').map(Number);
    const fechaLimiteDate = new Date(cy, cm - 1, cd);
    const diffDays = Math.round((fechaLimiteDate - fechaHoyDate) / (1000 * 60 * 60 * 24));

    // Regla 2.b: aviso_dias de Fides (por defecto 2 si esta vacio)
    const avisoDiasCard = (card.aviso_dias !== undefined && card.aviso_dias !== '' && !isNaN(parseInt(card.aviso_dias)))
      ? parseInt(card.aviso_dias)
      : 2;

    if (diffDays === 0) {
      alertasCandidatas.push({
        id_alerta: `tarjeta_${card.tarjeta}_${card.fecha_limite}_limite`,
        tipo: 'TARJETA_LIMITE',
        concepto: card.tarjeta,
        mensaje: `🚨 *¡Fecha límite HOY!* Tarjeta ${card.tarjeta}. Saldo para no generar intereses: $${saldo.toLocaleString('es-MX', {minimumFractionDigits: 2})}.`
      });
    } else if (diffDays === avisoDiasCard && avisoDiasCard > 0) {
      alertasCandidatas.push({
        id_alerta: `tarjeta_${card.tarjeta}_${card.fecha_limite}_previo_${avisoDiasCard}d`,
        tipo: 'TARJETA_PREVIO',
        concepto: card.tarjeta,
        mensaje: `💳 *Atención Tarjeta ${card.tarjeta}:* Saldo de $${saldo.toLocaleString('es-MX', {minimumFractionDigits: 2})} vence en ${avisoDiasCard} días (${card.fecha_limite}).`
      });
    }
  }

  const alertasNuevas = alertasCandidatas.filter(a => !enviadasSet.has(a.id_alerta));

  return {
    fecha_evaluada: todayStr,
    chat_id: chatIdParam,
    total_nuevas: alertasNuevas.length,
    alertas: alertasNuevas
  };
}

// Simulacion de 2026-10-23 y 2026-10-24 con aviso_dias = 2
console.log('\n--- SIMULACION 1: 2026-10-23 (con Auto aviso_dias = 2, Tarjetas aviso_dias = 2) ---');
const sim23 = runEngineV3({ fecha_hoy: '2026-10-23', autoAvisoDias: 2 });
console.log(`Alertas en 2026-10-23: ${sim23.total_nuevas}`);
sim23.alertas.forEach(a => console.log(` -> ID: ${a.id_alerta} | ${a.mensaje}`));

console.log('\n--- SIMULACION 2: 2026-10-24 (con Auto aviso_dias = 2, Tarjetas aviso_dias = 2) ---');
const sim24_a = runEngineV3({ fecha_hoy: '2026-10-24', autoAvisoDias: 2 });
console.log(`Alertas en 2026-10-24: ${sim24_a.total_nuevas}`);
sim24_a.alertas.forEach(a => console.log(` -> ID: ${a.id_alerta} | ${a.mensaje}`));

console.log('\n--- SIMULACION 3: 2026-10-24 (con Auto aviso_dias = 1 segun captura del usuario) ---');
const sim24_b = runEngineV3({ fecha_hoy: '2026-10-24', autoAvisoDias: 1 });
console.log(`Alertas en 2026-10-24: ${sim24_b.total_nuevas}`);
sim24_b.alertas.forEach(a => console.log(` -> ID: ${a.id_alerta} | ${a.mensaje}`));
