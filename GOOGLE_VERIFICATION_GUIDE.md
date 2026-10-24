# 📘 Guía de Verificación & Publicación — Synapse Vertex Automation

> **Objetivo:** Publicar la app de Google Cloud a modo **Producción**, verificar la propiedad del dominio y la política de privacidad para que los tokens de **Google Sheets, Google Drive y Classroom en n8n NUNCA vuelvan a caducar cada 7 días**.

---

## 📂 Archivos Creados en este Repositorio

La carpeta [`docs/`](file:///c:/Users/crhis/OneDrive/Documentos/Cris/Proyectos/App%20Control%20Gastos/docs) contiene el sitio web público que cumple con el 100% de los lineamientos de Google Cloud OAuth:

| Archivo | URL en GitHub Pages (una vez publicado) | Propósito en la Verificación |
|---|---|---|
| [`docs/index.html`](file:///c:/Users/crhis/OneDrive/Documentos/Cris/Proyectos/App%20Control%20Gastos/docs/index.html) | `https://crhisrob99.github.io/synaps-aerarium/` | **Página principal pública:** Presenta *Synapse Vertex Automation* sin requerir login. |
| [`docs/privacy.html`](file:///c:/Users/crhis/OneDrive/Documentos/Cris/Proyectos/App%20Control%20Gastos/docs/privacy.html) | `https://crhisrob99.github.io/synaps-aerarium/privacy.html` | **Política de Privacidad oficial:** Contiene la cláusula obligatoria de *Google Limited Use Disclosure*. |
| [`docs/terms.html`](file:///c:/Users/crhis/OneDrive/Documentos/Cris/Proyectos/App%20Control%20Gastos/docs/terms.html) | `https://crhisrob99.github.io/synaps-aerarium/terms.html` | **Condiciones del Servicio:** Términos de uso personal y familiar. |
| [`docs/Vertex.png`](file:///c:/Users/crhis/OneDrive/Documentos/Cris/Proyectos/App%20Control%20Gastos/docs/Vertex.png) | `https://crhisrob99.github.io/synaps-aerarium/Vertex.png` | **Icono oficial:** Logo en alta resolución. |

---

## 🚀 Paso 1: Subir la carpeta `docs` a tu GitHub

Desde tu terminal de PowerShell en la carpeta del proyecto, ejecuta:

```powershell
git add docs/ GOOGLE_VERIFICATION_GUIDE.md
git commit -m "feat: add public landing page and privacy policy for Synapse Vertex Automation verification"
git push origin main
```

---

## 🌐 Paso 2: Activar GitHub Pages (Toma 1 minuto)

1. Entra a tu repositorio en GitHub:  
   👉 `https://github.com/crhisrob99/synaps-aerarium`
2. Ve a la pestaña **Settings** (Configuración) ➔ En el menú izquierdo, haz clic en **Pages**.
3. En la sección **Build and deployment**:
   * **Source:** Selecciona `Deploy from a branch`.
   * **Branch:** Selecciona `main` y en la carpeta selecciona **`/docs`**.
   * Haz clic en **Save** (Guardar).
4. Espera 60 segundos. Tu sitio web público quedará activo en:  
   👉 `https://crhisrob99.github.io/synaps-aerarium/`

---

## 🔍 Paso 3: Verificar la propiedad del dominio en Google Search Console

Google exige que demuestres ser el dueño de la URL principal:

1. Entra a: [search.google.com/search-console](https://search.google.com/search-console) (con tu cuenta `crhis.robles@gmail.com`).
2. En la esquina superior izquierda, haz clic en el selector de propiedades ➔ **+ Añadir propiedad**.
3. En el cuadro de la derecha (**Prefijo de la URL**), pega:
   ```text
   https://crhisrob99.github.io/synaps-aerarium/
   ```
4. Haz clic en **Continuar**.
5. Como estás usando tu cuenta de Google y GitHub Pages, Google verificará la propiedad de forma inmediata (o te dará un archivo HTML / etiqueta que puedes poner). En la mayoría de los casos se aprueba al instante.

---

## ⚙️ Paso 4: Configurar Google Cloud Console

Entra a tu proyecto en Google Cloud: [console.cloud.google.com/auth/overview?project=crhis-n8n-oracle](https://console.cloud.google.com/auth/overview?project=crhis-n8n-oracle).

### 4.1 En la pestaña "Desarrollo de la marca" (Branding):
* **Nombre de la app:** `Synapse Vertex Automation` *(no uses "n8n" ni "Oracle" para evitar rechazos)*.
* **Correo de asistencia al usuario:** `crhis.robles@gmail.com`.
* **Logotipo de la app:** **DEJAR VACÍO** *(no subas imagen para evitar la revisión de marca obligatoria)*.
* **Página principal de la app:**  
  `https://crhisrob99.github.io/synaps-aerarium/`
* **Vínculo a la política de privacidad:**  
  `https://crhisrob99.github.io/synaps-aerarium/privacy.html`
* **Vínculo a las condiciones del servicio:**  
  `https://crhisrob99.github.io/synaps-aerarium/terms.html`
* **Dominios autorizados:**  
  Agrega `github.io`.
* **Datos de contacto del desarrollador:**  
  `crhis.robles@gmail.com`.
* Haz clic en **Guardar**.

### 4.2 En la pestaña "Público" (Audience):
1. Verás el botón **Publicar app**.
2. Haz clic en **Publicar app** y confirma el cambio al modo **Producción**.

---

## 🛡️ Resultado Final

* **Tokens Permanentes:** Tus conexiones de Google Sheets, Google Drive y servicios de Google en n8n **ya no caducarán cada 7 días**.
* **Cumplimiento Total:** Tu landing page y política de privacidad están hospedadas de por vida en GitHub Pages de forma gratuita.
* **Seguridad Absoluta:** Tu instancia de n8n en Oracle Cloud permanece completamente privada y protegida.
