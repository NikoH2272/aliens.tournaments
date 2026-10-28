# Aliens Tournaments

Landing page y panel administrativo para un torneo de esports con enfoque en competencia, cronograma, resultados y gestión de contenido.

## Descripción general

Este proyecto consiste en una página web estática para promocionar y publicar un campeonato competitivo (en este caso, un torneo de Free Fire LATAM) con:

- hero section visual con estilo futurista
- cronograma de fases del torneo
- contador regresivo para la próxima fecha
- secciones de torneo, rankings y comunidad
- soporte para datos dinámicos desde Supabase
- administrador para gestionar configuración, calendario, resultados y patrocinadores

La parte visible se compone principalmente de `index.html`, mientras que la lógica de datos y administración se encuentra en la carpeta `base/`.

## Estructura del repositorio

```text
aliens.tournaments/
├── index.html                # landing page principal del torneo
├── logo.png                  # logo del sitio
├── alien-bg.png              # fondo del hero
├── ALIENS LOGO.PNG           # alternativa de marca
├── base/
│   ├── admin.js              # administración del torneo (login / edición / guardado)
│   ├── common.js             # utilidades compartidas + conexión con Supabase
│   ├── config.js             # configuración de conexión a Supabase
│   ├── schema.sql            # esquema SQL para PostgreSQL / Supabase
│   ├── setup.sql             # configuración con funciones de staff y gestión
│   ├── aliens-seed.sql      # seed de ejemplo para iniciar el proyecto
│   ├── relampagos-creator.html # herramienta auxiliar para crear contenido visual
│   └── promptbase.txt        # base de prompts / referencia
└── README.md                 # documentación del proyecto
```

## Requisitos

- Navegador moderno
- Servidor web local opcional para abrir la app en localhost
- Base de datos PostgreSQL/Supabase para la parte administrativa
- Clave `anon` o `publishable` de Supabase configurada en `base/config.js`

## Inicio rápido

### Opción 1: abrir directamente

Puedes abrir `index.html` directamente en el navegador para ver el landing page estático.

### Opción 2: servidor local

Desde la raíz del proyecto:

```bash
python -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

## Configuración de datos

El proyecto está preparado para conectarse a Supabase. La configuración inicial se encuentra en:

- `base/config.js`

Debe quedar de esta forma:

```js
window.PYROCORE_CONFIG = {
  supabaseUrl: "https://tu-proyecto.supabase.co",
  supabaseAnonKey: "tu_clave_anon_o_publishable",
};
```

Importante:

- no uses una clave `service_role` en la configuración pública
- la clave `anon` es la recomendada para la parte del frontend
- la parte administrativa depende de funciones RPC y tablas SQL del proyecto

## Base de datos

Los scripts SQL están en `base/` y sirven para dejar el esquema del proyecto listo en Supabase.

### Archivos clave

- `base/schema.sql`: define tablas como `settings`, `staff_users`, `staff_sessions`, `schedule`, `result_groups`, `result_rows` y `sponsors`
- `base/setup.sql`: incluye funciones de login, validación de sesión y CRUD para administración
- `base/aliens-seed.sql`: contiene datos iniciales/semilla para arrancar con contenido base

### Tablas principales

- `settings`: información general del torneo, links y premios
- `schedule`: cronograma de fechas y partidos
- `result_groups`: grupos de resultados por fase
- `result_rows`: filas de equipos y puntajes
- `sponsors`: patrocinadores y branding visual
- `staff_users`: usuarios del panel administrativo
- `staff_sessions`: sesiones de administración activas

## Panel de administración

Aunque la página pública es un landing page, la carpeta `base` incluye un sistema de administración basado en JavaScript y funciones RPC de Supabase. Esto permite:

- editar nombre del torneo, lema, estado y datos generales
- ajustar cronograma
- crear y actualizar resultados por fase
- gestionar patrocinadores
- cambiar la portada y piezas visuales del torneo
- controlar permisos por rol (`editor` / `admin`)

## Personalización rápida

Puedes adaptar el proyecto sin tocar la estructura completa cambiando:

- textos de presentación en `index.html`
- colores y tipografías en el bloque `<style>` del documento
- fechas del torneo en el script del contador
- contenido visual y marca en `logo.png`, `ALIENS LOGO.PNG` y `alien-bg.png`

## Convenios del proyecto

- El front-end principal es estático y ligero
- La parte dinámica usa JavaScript del navegador
- La persistencia real se realiza con Supabase/PostgreSQL
- El diseño está orientado a un estilo competitivo, futurista y gamer

## Notas

Este repositorio no incluye un backend clásico tradicional. La aplicación se apoya en una combinación de:

- HTML/CSS/JS para la UI
- Supabase para almacenamiento y seguridad ligera
- scripts SQL para inicializar el modelo de datos y procedimientos del staff

## Siguientes pasos recomendados

- añadir una pantalla de administración complementaria con una ruta propia
- crear un flujo de inscripción de equipos
- conectar un formulario real de registro para jugadores/equipos
- documentar mejor los permisos y flujos de edición del panel
- preparar desplegue para Vercel, Netlify o hosting estático con CDN

## Licencia

Este proyecto no incluye una licencia explícita en el repositorio. Revisa con el propietario del código antes de utilizarlo en producción o distribuirlo fuera del contexto del torneo.
