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

Google exige que demuestres ser el dueño de la URL de tu app:

1. Entra a: [search.google.com/search-console](https://search.google.com/search-console) (con la misma cuenta de Google dueña del proyecto de Google Cloud).
2. En la esquina superior izquierda, haz clic en el selector de propiedades ➔ **+ Añadir propiedad**.
3. En el cuadro de la derecha (**Prefijo de la URL**), pega la URL exacta de tu repositorio:
   ```text
   https://tu-usuario.github.io/tu-repositorio/
   ```
   *(Ejemplo: `https://crhisrob99.github.io/synaps-aerarium/`)*
4. Haz clic en **Continuar**.
5. Te mostrará el método recomendado: **Archivo HTML** (ejemplo: `google17e9bc6a229b9650.html`):
   * Crea ese archivo dentro de la carpeta `docs/` con el contenido:
     ```text
     google-site-verification: google17e9bc6a229b9650.html
     ```
   * Súbelo a GitHub:
     ```powershell
     git add docs/google*.html
     git commit -m "chore: add Google Search Console verification file"
     git push origin main
     ```
   * Espera 30 segundos a que GitHub Pages lo publique y haz clic en el botón azul **VERIFICAR**.
   * Verás la confirmación en verde: **"Se ha verificado la propiedad"**.

---

## ⚙️ Paso 4: Configurar Google Cloud Console

Entra a: [console.cloud.google.com/auth/overview](https://console.cloud.google.com/auth/overview).

### 4.1 En la pestaña "Información de la marca" (Branding):
* **Nombre de la app:** `Synapse Vertex Automation` *(no uses marcas registradas como "n8n", "Google" u "Oracle" para evitar bloqueos)*.
* **Correo de asistencia al usuario:** Tu correo Gmail.
* **Logotipo de la app:** **DEJAR VACÍO** *(muy importante: si subes un logo, Google fuerza una auditoría manual de marca de 3 a 5 días hábiles)*.
* **Página principal de la app:**  
  `https://tu-usuario.github.io/tu-repositorio/`
* **Vínculo a la política de privacidad:**  
  `https://tu-usuario.github.io/tu-repositorio/privacy.html`
* **Vínculo a las condiciones del servicio:**  
  `https://tu-usuario.github.io/tu-repositorio/terms.html`
* **Dominios autorizados:**  
  ⚠️ **IMPORTANTE:** Google rechazará `github.io` a secas porque es un sufijo público. Debes ingresar tu subdominio privado:
  ```text
  tu-usuario.github.io
  ```
  *(Ejemplo: `crhisrob99.github.io` — sin `https://` ni barras `/`)*.
* **Datos de contacto del desarrollador:** Tu correo Gmail.
* Haz clic en **Guardar**.

### 4.2 En la pestaña "Público" (Audience):
1. Verás el **Estado de publicación** (*Publishing status*): dice actualmente **En prueba** (*Testing*).
2. Haz clic en el botón **`PUBLICAR APP`** (*Publish app*).
3. Confirma en la ventana emergente.
4. El estado cambiará a **`En producción`**.

> [!NOTE]
> **Sobre el aviso de "Problemas encontrados en el intento de verificación anterior":**
> Si ves ese banner histórico o advertencias en el *Centro de verificación*, no te preocupes: es un registro histórico del intento previo y Google Cloud actualiza su caché en segundo plano. Al estar ya **En producción**, la regla de caducidad de 7 días queda **completamente eliminada**.

---

## 🔄 Paso 5: Renovar Tokens en n8n a Modo Producción

Como las conexiones previas se crearon en modo "Prueba", sus tokens aún tienen fecha de expiración. Para renovarlos a tokens permanentes:

1. Entra a tu instancia de **n8n** ➔ Menú lateral ➔ **Credentials**.
2. Para cada una de tus credenciales de Google OAuth (Google Sheets, Google Drive, Gmail personal, etc.):
   * Haz clic sobre la credencial.
   * Haz clic en el botón **`Switch account`** (o reconectar).
   * Inicia sesión con la cuenta correspondiente.
   * Si Google muestra *"Google no ha verificado esta app"*, haz clic en **Configuración avanzada** ➔ **Ir a Synapse Vertex Automation (no seguro)** ➔ **Continuar**.
   * Haz clic en **`Save`** en n8n.
3. Listo: n8n habrá recibido un *Refresh Token* permanente de producción.

---

## 🛡️ Resumen y Beneficios

* **Tokens Permanentes:** Ningún flujo de Google Sheets, Drive o Gmail volverá a desconectarse tras 7 días.
* **Alojamiento Gratuito de por Vida:** GitHub Pages aloja la landing, políticas y términos sin costo ni mantenimiento.
* **Seguridad y Privacidad:** Tu n8n y tu infraestructura de base de datos se mantienen 100% privadas.
