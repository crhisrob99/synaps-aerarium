const XLSX = require('xlsx');

const wb = XLSX.readFile('Aerarium - Tabula Financia.xlsx');
const vectigalia = XLSX.utils.sheet_to_json(wb.Sheets['Vectigalia']);
const fides = XLSX.utils.sheet_to_json(wb.Sheets['Fides']);

function runEngine({ fecha_hoy = null, monitionesPrevias = [] }) {
  // 1. Determinar fecha de evaluacion
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

  // 1. Evaluar si hoy es dia de pago de quincena (14 y 30 / ultimo dia)
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

  // 2. Evaluar compromisos en Vectigalia
  for (const item of vectigalia) {
    if (item.activo !== 'SI' || item.tipo !== 'gasto') continue;

    const avisoDias = parseInt(item.aviso_dias || 0);
    const monto = parseFloat(item.monto || 0);

    // Parsear lista de dias: "14,30", "ultimo", "25", etc.
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

      // Evaluar ocurrencia en este mes
      const fechaPagoMesActual = new Date(y, m - 1, diaTarget);
      const fechaHoy = new Date(y, m - 1, d);
      let diffDays = Math.round((fechaPagoMesActual - fechaHoy) / (1000 * 60 * 60 * 24));

      // Si el pago es en los primeros dias del SIGUIENTE mes (ej. Renta dia 1 vista desde el 30/31 del mes previo)
      if (diffDays < 0 && diaTarget <= 5) {
        const nextMonthYear = m === 12 ? y + 1 : y;
        const nextMonth = m === 12 ? 1 : m + 1;
        const daysInNextMonth = new Date(nextMonthYear, nextMonth, 0).getDate();
        const targetNext = Math.min(diaTarget, daysInNextMonth);
        const fechaPagoNext = new Date(nextMonthYear, nextMonth - 1, targetNext);
        diffDays = Math.round((fechaPagoNext - fechaHoy) / (1000 * 60 * 60 * 24));
      }

      const fechaPagoStr = `${y}-${String(m).padStart(2, '0')}-${String(diaTarget).padStart(2, '0')}`;

      if (diffDays === 0) {
        alertasCandidatas.push({
          id_alerta: `${item.id}_${fechaPagoStr}_hoy`,
          tipo: 'PAGO_HOY',
          concepto: item.concepto,
          mensaje: `⚠️ *Hoy vence compromiso:* ${item.concepto} por $${monto.toLocaleString('es-MX', {minimumFractionDigits: 2})} (${item.cuenta || 'Débito'})`
        });
      } else if (diffDays === avisoDias && avisoDias > 0) {
        alertasCandidatas.push({
          id_alerta: `${item.id}_${fechaPagoStr}_previo_${avisoDias}d`,
          tipo: 'AVISO_PREVIO',
          concepto: item.concepto,
          mensaje: `🔔 *Próximo pago:* ${item.concepto} por $${monto.toLocaleString('es-MX', {minimumFractionDigits: 2})} vence en ${avisoDias} día(s) (el ${diaTarget}-${m}).`
        });
      }
    }
  }

  // 3. Evaluar tarjetas en Fides
  for (const card of fides) {
    if (card.pagada === 'SI' || !card.fecha_limite) continue;

    const saldo = parseFloat(card.saldo_pago_sin_intereses || 0);
    const [cy, cm, cd] = card.fecha_limite.split('-').map(Number);
    const fechaLimite = new Date(cy, cm - 1, cd);
    const fechaHoy = new Date(y, m - 1, d);
    const diffDays = Math.round((fechaLimite - fechaHoy) / (1000 * 60 * 60 * 24));

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

  // 4. Filtrar por Idempotencia
  const alertasNuevas = alertasCandidatas.filter(a => !enviadasSet.has(a.id_alerta));

  return {
    fecha_evaluada: todayStr,
    es_simulacion,
    total_alertas_generadas: alertasCandidatas.length,
    total_nuevas: alertasNuevas.length,
    alertas: alertasNuevas
  };
}

// Ejecutar simulacion en las fechas solicitadas por el usuario
const testDates = [
  '2026-10-13',
  '2026-10-14',
  '2026-10-23',
  '2026-10-25',
  '2026-10-30',
  '2026-11-04',
  '2027-02-28'
];

console.log('=== RESULTADOS DE SIMULACION ===\n');
for (const f of testDates) {
  const res = runEngine({ fecha_hoy: f });
  console.log(`📅 FECHA: ${f} (${res.total_nuevas} alertas)`);
  res.alertas.forEach((a, i) => {
    console.log(`  [${i + 1}] ID: ${a.id_alerta}`);
    console.log(`      Mensaje: ${a.mensaje}`);
  });
  console.log('--------------------------------------------------');
}

// Prueba de Idempotencia: ejecutar dos veces consecutivas
console.log('\n=== PRUEBA DE IDEMPOTENCIA (2 EJECUCIONES EN 2026-10-14) ===');
const primeraEjecucion = runEngine({ fecha_hoy: '2026-10-14', monitionesPrevias: [] });
console.log(`1ra Ejecución (Monitiones vacía): ${primeraEjecucion.total_nuevas} alertas generadas.`);
const idsEnviados = primeraEjecucion.alertas.map(a => a.id_alerta);

const segundaEjecucion = runEngine({ fecha_hoy: '2026-10-14', monitionesPrevias: idsEnviados });
console.log(`2da Ejecución (Monitiones con IDs ya registrados): ${segundaEjecucion.total_nuevas} alertas generadas.`);
if (segundaEjecucion.total_nuevas === 0) {
  console.log('✅ IDEMPOTENCIA CONFIRMADA: La 2da ejecución no envía nada.');
}
