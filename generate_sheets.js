const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

// 1. Vectigalia (Recurrentes) con aviso_dias ajustados segun preferencia del usuario
const vectigaliaData = [
  ['id', 'concepto', 'tipo', 'monto', 'frecuencia', 'dia', 'mes_inicio', 'fecha_inicio', 'fecha_fin', 'categoria', 'cuenta', 'es_deuda', 'aviso_dias', 'activo'],
  ['ingreso_sueldo', 'Sueldo', 'ingreso', 22200, 'quincenal', '14,30', '', '2026-10-14', '', 'Ingresos', 'BBVA debito', 'NO', 0, 'SI'],
  ['gasto_renta', 'Renta', 'gasto', 8400, 'mensual', '1', '', '2026-10-01', '', 'Vivienda', 'BBVA debito', 'NO', 1, 'SI'],
  ['gasto_hogar', 'Gasto hogar (Wendy)', 'gasto', 5500, 'quincenal', '14,30', '', '2026-10-14', '', 'Hogar', 'BBVA debito', 'NO', 1, 'SI'],
  ['gasto_internet', 'Internet', 'gasto', 504, 'mensual', '6', '', '2026-10-06', '', 'Servicios', 'BBVA debito', 'NO', 1, 'SI'],
  ['gasto_luz', 'Luz', 'gasto', 500, 'bimestral', '15', 11, '2026-11-15', '', 'Servicios', 'BBVA debito', 'NO', 2, 'SI'],
  ['gasto_gas', 'Gas', 'gasto', 400, 'bimestral', '15', 12, '2026-12-15', '', 'Servicios', 'BBVA debito', 'NO', 2, 'SI'],
  ['gasto_auto', 'Auto', 'gasto', 5300, 'mensual', '25', '', '2026-10-25', '', 'Transporte', 'BBVA debito', 'NO', 1, 'SI'],
  ['deuda_mp', 'Prestamo Mercado Pago', 'gasto', 2848.27, 'mensual', '16', '', '2026-10-16', '2027-03-16', 'Deuda', 'Mercado Pago', 'SI', 1, 'SI']
];
const wsVectigalia = XLSX.utils.aoa_to_sheet(vectigaliaData);
XLSX.utils.book_append_sheet(wb, wsVectigalia, 'Vectigalia');

// 2. Acta (Movimientos)
const actaData = [
  ['fecha', 'tipo', 'concepto', 'monto', 'categoria', 'quincena', 'origen'],
  ['2026-10-14', 'ingreso', 'Sueldo Quincenal', 22200, 'Ingresos', '2026-10-Q1', 'auto']
];
const wsActa = XLSX.utils.aoa_to_sheet(actaData);
XLSX.utils.book_append_sheet(wb, wsActa, 'Acta');

// 3. Fides (Tarjetas) con columna aviso_dias (Columna E)
const fidesData = [
  ['tarjeta', 'saldo_pago_sin_intereses', 'fecha_limite', 'pagada', 'aviso_dias'],
  ['BBVA Blue', 3523.71, '2026-10-26', 'NO', 2],
  ['Mercado Pago', 1598.95, '2026-11-09', 'NO', 2]
];
const wsFides = XLSX.utils.aoa_to_sheet(fidesData);
XLSX.utils.book_append_sheet(wb, wsFides, 'Fides');

// 4. Parametra (Config)
const parametraData = [
  ['parametro', 'valor', 'descripcion'],
  ['ingreso_quincenal_promedio', 22200, 'Sueldo promedio neto por quincena'],
  ['dias_pago', '14,30', 'Dias de corte y pago de quincenas (14 al 29 / 30 al 13)'],
  ['umbral_margen_minimo', 1500, 'Alerta roja si el margen cae por debajo de este monto'],
  ['meta_ahorro_mensual', 1500, 'Meta proyectada de ahorro mensual'],
  ['telegram_chat_id', '1954772302', 'ID numerico del usuario para autorizar mensajes en Synaps'],
  ['presupuesto_gasolina_quincenal', 1600, 'Presupuesto maximo quincenal en combustible'],
  ['presupuesto_personales_quincenal', 3000, 'Presupuesto maximo quincenal en gastos personales']
];
const wsParametra = XLSX.utils.aoa_to_sheet(parametraData);
XLSX.utils.book_append_sheet(wb, wsParametra, 'Parametra');

// 5. Monitiones (Log_alertas)
const monitionesData = [
  ['id_alerta', 'fecha_envio', 'tipo', 'mensaje']
];
const wsMonitiones = XLSX.utils.aoa_to_sheet(monitionesData);
XLSX.utils.book_append_sheet(wb, wsMonitiones, 'Monitiones');

// 6. Conspectus (Resumen)
const conspectusData = [
  ['METRICA DE QUINCENA ACTUAL', 'VALOR', 'REFERENCIA'],
  ['Identificador de Quincena', '2026-10-Q1', 'Ventana: 14 al 29 de octubre'],
  ['Ingresos Reales de Quincena', '=SUMAR.SI.CONJUNTO(Acta!D:D; Acta!B:B; "ingreso"; Acta!F:F; B2)', 'Sueldo + extras registrados'],
  ['Gastos Variables Registrados', '=SUMAR.SI.CONJUNTO(Acta!D:D; Acta!B:B; "gasto"; Acta!F:F; B2)', 'Gasto diario en Acta'],
  ['Compromisos Fijos del Periodo', 13748.27, 'Hogar (5500) + Prestamo MP (2848.27) + Auto (5300)'],
  ['Presupuesto Variable Estimado', 4600, 'Gasolina (1600) + Personales (3000)'],
  ['Margen Estimado de Maniobra', '=B3 - B4 - B5', 'Ingresos - Variables - Fijos'],
  ['Estado del Margen', '=SI(B7 < 1500; "ALERTA: MARGEN BAJO"; "SALUDABLE")', 'Regla umbral_margen_minimo']
];
const wsConspectus = XLSX.utils.aoa_to_sheet(conspectusData);
XLSX.utils.book_append_sheet(wb, wsConspectus, 'Conspectus');

const outputPath = path.join(__dirname, 'Aerarium - Tabula Financia.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('Archivo actualizado exitosamente en:', outputPath);
