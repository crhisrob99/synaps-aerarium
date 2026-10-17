const XLSX = require('xlsx');

const wb = XLSX.readFile('Aerarium - Tabula Financia.xlsx');
let vectigalia = XLSX.utils.sheet_to_json(wb.Sheets['Vectigalia']);
let acta = XLSX.utils.sheet_to_json(wb.Sheets['Acta']);
let parametra = XLSX.utils.sheet_to_json(wb.Sheets['Parametra']);

console.log('Parametra:', parametra);
console.log('Acta actual:', acta);

// Probar calculo de presupuesto al capturar un gasto
function simularCapturaGasto({ texto, fecha_simulada = '2026-10-14 10:00:00' }) {
  const [datePart, timePart] = fecha_simulada.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);

  // Calcular quincena
  let quincenaTag = '';
  if (d >= 14 && d <= 29) {
    quincenaTag = `${y}-${String(m).padStart(2, '0')}-Q1`;
  } else if (d >= 30) {
    quincenaTag = `${y}-${String(m).padStart(2, '0')}-Q2`;
  } else {
    let prevM = (m === 1) ? 12 : m - 1;
    let prevY = (m === 1) ? y - 1 : y;
    quincenaTag = `${prevY}-${String(prevM).padStart(2, '0')}-Q2`;
  }

  // Parseo
  let tipo = 'gasto';
  let monto = 0;
  const isIngreso = /\b(extra|ingreso|bono|sueldo)\b/i.test(texto);
  if (isIngreso) tipo = 'ingreso';

  const amountMatch = texto.match(/\$?(\d+([.,]\d{1,2})?)/);
  if (amountMatch) monto = parseFloat(amountMatch[1].replace(',', '.'));

  let concepto = texto.replace(/\$?(\d+([.,]\d{1,2})?)/, '').replace(/\b(extra|gasto|compre|pague)\b/gi, '').trim();
  if (!concepto) concepto = (tipo === 'ingreso') ? 'Ingreso Extra' : 'Varios';
  concepto = concepto.charAt(0).toUpperCase() + concepto.slice(1);

  let categoria = 'Personales';
  const cLower = concepto.toLowerCase();
  if (tipo === 'gasto') {
    if (/gasolina|gas|uber|taxi|peaje|auto/.test(cLower)) categoria = 'Transporte';
    else if (/despensa|super|walmart|comida hogar|mandado/.test(cLower)) categoria = 'Hogar';
    else if (/farmacia|medicina|doctor|salud/.test(cLower)) categoria = 'Salud';
    else if (/luz|cfe|internet|agua|renta/.test(cLower)) categoria = 'Servicios';
    else categoria = 'Personales';
  } else {
    categoria = 'Extra';
  }

  // Buscar presupuesto en Parametra
  let presupuestoCat = 0;
  if (categoria === 'Transporte') {
    presupuestoCat = parseFloat(parametra.find(p => p.parametro === 'presupuesto_gasolina_quincenal')?.valor || 1600);
  } else if (categoria === 'Personales') {
    presupuestoCat = parseFloat(parametra.find(p => p.parametro === 'presupuesto_personales_quincenal')?.valor || 3000);
  }

  // Sumar gastos acumulados de la quincena en Acta
  const gastosQuincena = acta.filter(row => row.tipo === 'gasto' && row.quincena === quincenaTag);
  const gastoPrevioCat = gastosQuincena
    .filter(row => row.categoria === categoria)
    .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);

  const nuevoTotalCat = gastoPrevioCat + monto;

  let alertaPresupuesto = '';
  if (presupuestoCat > 0) {
    const pct = Math.round((nuevoTotalCat / presupuestoCat) * 100);
    const restante = Math.max(0, presupuestoCat - nuevoTotalCat);
    if (pct >= 100) {
      alertaPresupuesto = `🚨 *LÍMITE REBASADO:* ${pct}% ($${nuevoTotalCat.toLocaleString('es-MX')} de $${presupuestoCat.toLocaleString('es-MX')}). Rebasaste por $${(nuevoTotalCat - presupuestoCat).toLocaleString('es-MX')}.`;
    } else if (pct >= 80) {
      alertaPresupuesto = `⚠️ *PRESUPUESTO AL ${pct}%:* Llevas $${nuevoTotalCat.toLocaleString('es-MX')} de $${presupuestoCat.toLocaleString('es-MX')}. Restan: $${restante.toLocaleString('es-MX')}.`;
    } else {
      alertaPresupuesto = `📊 *Presupuesto:* ${pct}% consumido ($${nuevoTotalCat.toLocaleString('es-MX')} de $${presupuestoCat.toLocaleString('es-MX')}). Disponible: $${restante.toLocaleString('es-MX')}.`;
    }
  }

  return {
    tipo,
    concepto,
    monto,
    categoria,
    quincena: quincenaTag,
    alertaPresupuesto
  };
}

console.log('\n--- PRUEBA 1: Gasto normal en presupuesto ---');
console.log(simularCapturaGasto({ texto: 'gasolina 500' }));

console.log('\n--- PRUEBA 2: Gasto al 85% ---');
acta.push({ fecha: '2026-10-14', tipo: 'gasto', concepto: 'Gasolina', monto: 850, categoria: 'Transporte', quincena: '2026-10-Q1', origen: 'telegram' });
console.log(simularCapturaGasto({ texto: 'gasolina 500' }));

console.log('\n--- PRUEBA 3: Gasto rebasando el 100% ---');
console.log(simularCapturaGasto({ texto: 'gasolina 400' }));
