# Charlemos 🗣️

Una PWA sencilla para conversar por voz, en español, con una compañía cálida.
Pensada para usarse a diario desde el celular.

## 1. Consigue tus 3 llaves (API keys)

Necesitas tres datos. Guárdalos en un lugar seguro.

**Anthropic (la conversación):**
1. Entra a https://console.anthropic.com y crea una cuenta.
2. Ve a *API Keys* → *Create Key* → copia la clave (empieza con `sk-ant-...`).

**ElevenLabs (la voz):**
1. Entra a https://elevenlabs.io y crea una cuenta.
2. En tu perfil copia tu *API Key*.
3. En *Voices* elige una voz en español latino y copia su *Voice ID*.

## 2. Súbela a internet con Vercel (gratis)

1. Crea una cuenta en https://vercel.com con "Continue with GitHub".
2. Sube esta carpeta a un repositorio de GitHub
   (o, desde la carpeta, ejecuta `npx vercel` y sigue las preguntas).
3. En Vercel: *Add New → Project* e importa el repositorio.
4. Antes de desplegar, abre *Environment Variables* y agrega:
   - `ANTHROPIC_API_KEY` = tu clave de Anthropic
   - `ELEVENLABS_API_KEY` = tu clave de ElevenLabs
   - `ELEVENLABS_VOICE_ID` = el Voice ID que copiaste (se usa como respaldo interno del servidor)
5. Pulsa *Deploy*. En un minuto tendrás un enlace como
   `https://charlemos-xxxx.vercel.app`.

## 3. Instálala en el celular Android

1. Abre ese enlace en **Google Chrome** del celular.
2. Toca el menú ⋮ (arriba a la derecha).
3. Elige **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**.
4. Confirma. Aparecerá el ícono **Charlemos** en la pantalla de inicio.
5. La primera vez que toques el micrófono, pulsa **Permitir** para el micrófono.

## 4. Cómo se usa

1. Abre Charlemos desde la pantalla de inicio.
2. Toca **"¿De qué quieres hablar hoy?"** y elige un tema.
3. Escucha y lee lo que dice la app. Toca el **micrófono** y responde hablando.
4. Para cambiar de tema, usa **"Cambiar tema"**.
5. Para cambiar el nombre, la voz, el volumen o el nivel de conversación, toca **Ajustes**.

## 5. Ajustar el nivel de conversación (importante)

En **Ajustes → ¿Cómo va hablando?** puedes indicar cuánto está hablando Dario:

- **Apenas empezando (mucha ayuda):** La app hace preguntas muy simples de 1-2 palabras. Usa esto al principio.
- **Va mejorando:** Preguntas un poco más completas de 3-4 palabras.
- **Habla muy bien (charla normal):** Conversación natural y fluida. ¡Es la meta!

Ve cambiando el nivel a medida que veas progreso.

## Problemas frecuentes

- **No se escucha la voz:** revisa que las 3 variables estén bien escritas en
  Vercel (Settings → Environment Variables) y vuelve a desplegar.
- **El micrófono no escucha:** usa Chrome y concede el permiso de micrófono.
  La captura de voz necesita conexión a internet.
- **Dice que no se pudo conectar:** revisa el internet del celular.
- **La voz no entiende lo que dice:** es normal al principio. La app seguirá la
  conversación con amabilidad aunque no entienda perfectamente.

## Desarrollo local

```bash
npm test           # corre las pruebas
npx vercel dev     # levanta la app en http://localhost:3000
```
