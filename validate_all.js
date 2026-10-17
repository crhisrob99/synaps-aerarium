const fs = require('fs');
const path = require('path');

const files = [
  'synaps_captura_gasto.json',
  'synaps_alertas_diarias.json',
  'synaps_heartbeat.json',
  'synaps_error_trigger.json',
  'synaps_resumen_quincena.json',
  'synaps_dashboard_api.json'
];

let allValid = true;

for (const file of files) {
  const filePath = path.join(__dirname, file);
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`✅ ${file}: JSON válido (Nodos: ${content.nodes.length})`);
    
    // Validar sintaxis de código en Code nodes
    for (const node of content.nodes) {
      if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
        try {
          new Function('$input', '$', node.parameters.jsCode);
          console.log(`   ✔️ Código en nodo "${node.name}" sintácticamente correcto.`);
        } catch (syntaxErr) {
          console.error(`   ❌ Error de sintaxis en nodo "${node.name}":`, syntaxErr.message);
          allValid = false;
        }
      }
    }
  } catch (err) {
    console.error(`❌ Error en ${file}:`, err.message);
    allValid = false;
  }
}

if (allValid) {
  console.log('\n🎉 TODOS LOS ARCHIVOS WORKFLOW SON 100% VÁLIDOS.');
} else {
  process.exit(1);
}
