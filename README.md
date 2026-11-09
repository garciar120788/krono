# Krono

Organizador personal con estilo de cuaderno: **tareas**, **notas diarias**, **notas libres**, **hábitos** y **calendario**, todo en una sola aplicación web que corre en Docker.

- Cada día se crea sola una **nota nueva en blanco**.
- Varios usuarios: cada persona tiene su cuenta y sus propios datos.
- Funciona en tu red local (`http://IP-DE-LA-PC:8080`) y, si quieres, también desde internet con HTTPS.

---

## Contenido

1. [Funciones](#funciones)
2. [Tecnologías](#tecnologías)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Instalación en Ubuntu (paso a paso)](#instalación-en-ubuntu-paso-a-paso)
5. [Variables de entorno](#variables-de-entorno)
6. [Uso diario: comandos útiles](#uso-diario-comandos-útiles)
7. [Actualizar Krono](#actualizar-krono)
8. [Respaldos y restauración](#respaldos-y-restauración)
9. [Acceso desde internet](#acceso-desde-internet)
10. [Seguridad](#seguridad)
11. [Desarrollo local](#desarrollo-local)
12. [Base de datos y migraciones](#base-de-datos-y-migraciones)
13. [API](#api)
14. [Solución de problemas](#solución-de-problemas)
15. [Subir el proyecto a GitHub](#subir-el-proyecto-a-github)

---

## Funciones

| Sección | Qué hace |
| --- | --- |
| **Hoy** | Resumen del día: tareas pendientes, nota del día, mini calendario con la agenda de hoy y los hábitos de la semana con su racha. |
| **Tareas** | Listas (Trabajo, Personal, Casa, Finanzas y las que crees), prioridad alta/media/baja, subtareas, notas por tarea, vista **Lista** o **Tablero** (Por hacer / En progreso / Hecho). Las completadas se ocultan y se pueden mostrar con un botón. |
| **Notas** | **Diario**: una hoja en blanco por día, navegación por fecha y buscador. **Mis notas**: notas libres organizadas en carpetas. Todo se guarda solo mientras escribes. |
| **Hábitos** | Hábitos diarios de sí/no. Cuadrícula semanal para marcarlos y mapa de progreso por **mes** o **año** (todos los hábitos o uno solo). |
| **Calendario** | Vistas **Mes** y **Semana**. Eventos con categoría y color, lugar, descripción, eventos de **todo el día** (también de varios días) y **repeticiones** (diaria, semanal, mensual, anual). |
| **Buscar** | Busca en tareas, notas, diario y eventos desde la barra superior. |
| **Ajustes** | Cambiar nombre y contraseña, cerrar sesión y eliminar la cuenta. |

## Tecnologías

- **[Next.js 15](https://nextjs.org/)** (App Router, React 19, TypeScript): interfaz y API en un solo proyecto.
- **PostgreSQL 16**: base de datos.
- **[Drizzle ORM](https://orm.drizzle.team/)**: acceso a datos y migraciones SQL.
- **Autenticación propia**: contraseñas con `bcrypt` y sesión en cookie `httpOnly` firmada (JWT con `jose`).
- **Docker + Docker Compose**: dos contenedores, `krono-web` (la app) y `krono-db` (PostgreSQL).
- Tipografías incluidas en el proyecto (Lora, Source Sans 3 y Caveat), no dependen de Google Fonts.

## Estructura del proyecto

```
krono/
├── Dockerfile                 # Imagen de la app (compilación en 3 etapas)
├── docker-compose.yml         # App + PostgreSQL (lo que usarás en Ubuntu)
├── docker-compose.dev.yml     # Expone PostgreSQL en localhost para desarrollo
├── .env.example               # Plantilla de variables de entorno
├── deploy/
│   ├── Caddyfile              # Proxy HTTPS (opcional)
│   └── docker-compose.caddy.yml
├── scripts/
│   ├── backup.sh              # Respaldo de la base de datos
│   └── restore.sh             # Restaurar un respaldo
├── drizzle/                   # Migraciones SQL (se aplican solas al arrancar)
├── public/
└── src/
    ├── instrumentation.ts     # Al arrancar: valida config y aplica migraciones
    ├── db/
    │   ├── schema.ts          # Tablas
    │   ├── index.ts           # Conexión
    │   └── migrate.ts
    ├── lib/                   # Autenticación, validaciones, fechas, repeticiones…
    ├── components/            # Pantallas (Dashboard, TasksView, NotesView, …)
    └── app/
        ├── (auth)/            # /login y /registro
        ├── (app)/             # Páginas con sesión: /, /tareas, /notas, /habitos, /calendario, /ajustes, /buscar
        └── api/               # API REST
```

---

## Instalación en Ubuntu (paso a paso)

Probado para Ubuntu 22.04 y 24.04. Los comandos se escriben en la terminal de la PC donde correrá Krono.

### 1. Instalar Docker

Si ya tienes Docker y `docker compose` (versión 2.24 o mayor), salta al paso 2.

```bash
# Quitar versiones viejas (si las hay)
sudo apt remove -y docker.io docker-compose docker-doc podman-docker containerd runc 2>/dev/null

# Repositorio oficial de Docker
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Usar docker sin sudo (cierra sesión y vuelve a entrar después de esto)
sudo usermod -aG docker $USER
```

Comprueba la instalación:

```bash
docker --version
docker compose version
```

### 2. Descargar el proyecto

```bash
cd ~
git clone https://github.com/TU-USUARIO/krono.git
cd krono
```

### 3. Configurar las variables de entorno

```bash
cp .env.example .env

# Genera una contraseña para la base de datos y una clave para las sesiones
echo "POSTGRES_PASSWORD: $(openssl rand -hex 24)"
echo "AUTH_SECRET:       $(openssl rand -base64 48)"

nano .env
```

En `nano`, pega los valores generados en `POSTGRES_PASSWORD` y `AUTH_SECRET`, y guarda con `Ctrl+O`, `Enter`, `Ctrl+X`.
Más detalles en [Variables de entorno](#variables-de-entorno).

### 4. Construir y arrancar

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos porque descarga las imágenes y compila la app. Revisa que todo esté bien:

```bash
docker compose ps          # ambos contenedores deben decir "running" / "healthy"
docker compose logs -f web # debe aparecer "[krono] Base de datos al día."  (Ctrl+C para salir)
```

### 5. Abrir Krono

- En la misma PC: <http://localhost:8080>
- Desde otra computadora o celular de tu red: `http://IP-DE-LA-PC:8080`

Para saber la IP de la PC:

```bash
hostname -I | awk '{print $1}'
```

Entra a **Regístrate** y crea tu cuenta. Al registrarte se crean listas, carpetas y categorías iniciales.

### 6. (Recomendado) Firewall

Si usas `ufw`, permite el puerto 8080 solo dentro de tu red local (ajusta el rango a tu red):

```bash
sudo ufw allow from 192.168.1.0/24 to any port 8080 proto tcp
sudo ufw enable
sudo ufw status
```

> Docker publica puertos por su cuenta y puede saltarse algunas reglas de `ufw`. Si la PC está conectada directamente a internet (sin router), usa la opción de [Caddy](#opción-a-dominio-propio-con-https-caddy) o [Tailscale](#opción-b-tailscale-sin-abrir-puertos) y no expongas el 8080.

### 7. Arranque automático

Los contenedores tienen `restart: unless-stopped`: se levantan solos cuando la PC se reinicia, siempre que Docker esté habilitado:

```bash
sudo systemctl enable docker
```

---

## Variables de entorno

Se definen en el archivo `.env` (nunca lo subas a GitHub; ya está en `.gitignore`).

| Variable | Obligatoria | Valor por defecto | Descripción |
| --- | --- | --- | --- |
| `POSTGRES_USER` | no | `krono` | Usuario de PostgreSQL. |
| `POSTGRES_PASSWORD` | **sí** | — | Contraseña de PostgreSQL. Usa solo letras y números (`openssl rand -hex 24`). |
| `POSTGRES_DB` | no | `krono` | Nombre de la base de datos. |
| `AUTH_SECRET` | **sí** | — | Clave para firmar las sesiones, mínimo 32 caracteres (`openssl rand -base64 48`). Si la cambias, todos tendrán que volver a iniciar sesión. |
| `ALLOW_REGISTRATION` | no | `true` | `false` oculta y bloquea el registro de cuentas nuevas. Recomendado una vez creadas tus cuentas, sobre todo si Krono está en internet. |
| `COOKIE_SECURE` | no | `false` | `true` solo si entras por **HTTPS**. Con `http://IP:8080` debe quedar en `false` o no podrás iniciar sesión. |
| `WEB_PORT` | no | `8080` | Puerto de la PC donde se publica la app. |
| `TZ` | no | `America/Mexico_City` | Zona horaria de los contenedores (registros y respaldos). La fecha de "hoy" de cada usuario la toma su navegador. |
| `KRONO_DOMAIN` | solo con Caddy | — | Dominio para HTTPS, ej. `krono.midominio.com`. |
| `DATABASE_URL` | solo desarrollo | — | Conexión para `npm run dev`. Docker arma la suya y la ignora. |

> ⚠️ **No cambies `POSTGRES_PASSWORD` después del primer arranque**: PostgreSQL guarda la contraseña en su volumen la primera vez. Si necesitas cambiarla, hazlo dentro de la base (`ALTER USER krono PASSWORD '...'`) y luego en `.env`.

---

## Uso diario: comandos útiles

Ejecútalos dentro de la carpeta `krono`.

```bash
docker compose ps                 # Estado de los contenedores
docker compose logs -f web        # Ver registros de la app
docker compose logs -f db         # Ver registros de PostgreSQL
docker compose stop               # Detener Krono (los datos se conservan)
docker compose start              # Volver a iniciarlo
docker compose restart web        # Reiniciar solo la app
docker compose down               # Apagar y borrar contenedores (los datos se conservan en el volumen)
docker compose exec db psql -U krono -d krono   # Consola de PostgreSQL
```

> ⚠️ `docker compose down -v` **borra el volumen con todos los datos**. No lo uses salvo que quieras empezar de cero.

## Actualizar Krono

Cuando subas cambios a GitHub:

```bash
cd ~/krono
./scripts/backup.sh               # (recomendado) respaldo antes de actualizar
git pull
docker compose up -d --build
docker image prune -f             # limpia imágenes viejas
```

Las migraciones nuevas de la base de datos se aplican solas al arrancar.

---

## Respaldos y restauración

Los datos viven en el volumen de Docker `krono_krono_db`.

### Crear un respaldo

```bash
./scripts/backup.sh
```

Genera `backups/krono_AAAA-MM-DD_HHMMSS.sql.gz` y conserva los 30 más recientes. La carpeta `backups/` está en `.gitignore`.

### Respaldo automático diario (cron)

```bash
crontab -e
```

Agrega esta línea (respaldo diario a las 3:15 am; cambia la ruta si clonaste en otro lugar):

```
15 3 * * * cd /home/TU-USUARIO/krono && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Copia de vez en cuando la carpeta `backups/` a otro disco o a la nube.

### Restaurar

```bash
./scripts/restore.sh backups/krono_2026-11-03_031500.sql.gz
```

El script detiene la app, reemplaza los datos y la vuelve a iniciar.

---

## Acceso desde internet

Elige **una** opción.

### Opción A: dominio propio con HTTPS (Caddy)

Necesitas:

1. Un dominio o subdominio (ej. `krono.midominio.com`) con un registro **A** apuntando a la **IP pública** de tu casa. Si tu IP cambia, usa un DNS dinámico (DuckDNS, Cloudflare, No-IP…).
2. En tu router, **reenviar los puertos 80 y 443** a la IP local de la PC con Ubuntu.
3. En `.env`:

   ```env
   KRONO_DOMAIN=krono.midominio.com
   ALLOW_REGISTRATION=false   # después de crear tus cuentas
   ```

4. Arrancar con el archivo de Caddy:

   ```bash
   docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d --build
   ```

Caddy obtiene y renueva solo el certificado HTTPS (Let's Encrypt). Con esta opción:

- `COOKIE_SECURE` se activa automáticamente.
- El puerto 8080 queda solo en `localhost`; desde la red se entra por `https://krono.midominio.com`.

Para no escribir los dos `-f` cada vez, puedes crear un alias o el archivo `docker-compose.override.yml` (está en `.gitignore`):

```bash
cp deploy/docker-compose.caddy.yml docker-compose.override.yml
docker compose up -d --build      # ahora incluye Caddy automáticamente
```

### Opción B: Tailscale (sin abrir puertos)

La forma más sencilla y segura si solo tú (o tu familia) van a entrar: una red privada entre tus dispositivos, sin tocar el router.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
```

Instala Tailscale en tu celular o laptop con la misma cuenta y abre `http://IP-DE-TAILSCALE:8080`.

Para tener HTTPS con Tailscale:

```bash
sudo tailscale serve --bg 8080
```

Krono queda en `https://NOMBRE-DE-LA-PC.TU-RED.ts.net`. En ese caso pon `COOKIE_SECURE=true` en `.env` y reinicia con `docker compose up -d`.

---

## Seguridad

- **Contraseñas:** se guardan con `bcrypt` (costo 12), nunca en texto plano.
- **Sesiones:** cookie `httpOnly` y `SameSite=Lax` que dura 30 días; con `COOKIE_SECURE=true` solo viaja por HTTPS.
- **Inicio de sesión:** máximo 10 intentos por correo e IP cada 15 minutos, y máximo 10 registros por IP cada hora.
- **Aislamiento:** cada consulta a la API filtra por el usuario de la sesión, así que nadie puede ver ni modificar datos de otra cuenta.
- **Base de datos:** PostgreSQL no se publica fuera de Docker.
- **Contenedor:** la app corre con un usuario sin privilegios.
- **Buscadores:** las páginas se marcan `noindex` y `robots.txt` bloquea a los buscadores.
- **Al exponer a internet:** pon `ALLOW_REGISTRATION=false` y usa HTTPS.

---

## Desarrollo local

Requisitos: Node.js 20 o 22 y Docker.

```bash
cp .env.example .env              # completa POSTGRES_PASSWORD, AUTH_SECRET y DATABASE_URL
npm install

# Solo la base de datos, expuesta en localhost:5432
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db

npm run dev                       # http://localhost:8080 (aplica migraciones al arrancar)
```

> En `.env`, la contraseña de `DATABASE_URL` debe ser la misma que `POSTGRES_PASSWORD`.

Scripts disponibles:

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 8080. |
| `npm run build` | Compilación de producción. |
| `npm start` | Ejecuta la compilación en el puerto 8080. |
| `npm run typecheck` | Revisión de tipos de TypeScript. |
| `npm run db:generate` | Genera una migración SQL nueva a partir de `src/db/schema.ts`. |
| `npm run db:migrate` | Aplica migraciones manualmente. |
| `npm run db:studio` | Explorador visual de la base (Drizzle Studio). |

## Base de datos y migraciones

Tablas principales:

| Tabla | Contenido |
| --- | --- |
| `users` | Cuentas (nombre, correo, hash de contraseña). |
| `task_lists`, `tasks`, `subtasks` | Listas, tareas (prioridad, estado, notas) y subtareas. |
| `daily_notes` | Una nota por usuario y día (`unique(user_id, date)`). |
| `note_folders`, `notes` | Carpetas y notas libres. |
| `habits`, `habit_logs` | Hábitos y los días cumplidos (una fila = día hecho). |
| `event_categories`, `events` | Categorías y eventos (todo el día, rango de fechas, hora, repetición). |

Todas las tablas tienen `ON DELETE CASCADE` hacia `users`: eliminar una cuenta borra todos sus datos.

**Cómo se crea la nota de cada día:** no hay tarea programada a medianoche. La primera vez que abres Krono en un día nuevo, la app pide la nota de esa fecha (según el reloj de tu navegador) y el servidor la crea en blanco si no existe. Por eso cada día tiene su hoja nueva y no se generan notas vacías de días en que no abriste la app.

**Cambiar el esquema:**

1. Edita `src/db/schema.ts`.
2. Ejecuta `npm run db:generate -- --name descripcion_del_cambio`.
3. Revisa el SQL nuevo en `drizzle/` y súbelo a git junto con el cambio.
4. Al desplegar (`docker compose up -d --build`) la migración se aplica sola.

---

## API

Todas las rutas responden JSON. Salvo las de autenticación y salud, requieren la cookie de sesión. Los errores tienen la forma `{ "error": "mensaje" }`. Las fechas van como `AAAA-MM-DD` y las horas como `HH:MM`.

### Autenticación

| Método | Ruta | Cuerpo / notas |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{ name, email, password }`, solo si `ALLOW_REGISTRATION=true`. |
| `POST` | `/api/auth/login` | `{ email, password }` |
| `POST` / `GET` | `/api/auth/logout` | Cierra la sesión (`GET` redirige a `/login`). |
| `GET` | `/api/auth/me` | Usuario actual. |
| `PATCH` | `/api/auth/me` | `{ name?, currentPassword?, newPassword? }` |
| `DELETE` | `/api/auth/me` | `{ password }`: elimina la cuenta y sus datos. |
| `GET` | `/api/health` | Estado de la app y la base (lo usa Docker). |

### Tareas

| Método | Ruta | Cuerpo / notas |
| --- | --- | --- |
| `GET` | `/api/lists` | Listas con su número de pendientes. |
| `POST` | `/api/lists` | `{ name, color? }` |
| `PATCH` / `DELETE` | `/api/lists/:id` | `{ name?, color?, position? }`. `DELETE` borra también sus tareas. |
| `GET` | `/api/tasks?listId=&status=` | Tareas con subtareas. |
| `POST` | `/api/tasks` | `{ title, listId, priority?: alta\|media\|baja, status?: todo\|doing\|done, notes? }` |
| `GET` / `PATCH` / `DELETE` | `/api/tasks/:id` | `PATCH { title?, listId?, priority?, status?, notes? }` |
| `POST` | `/api/tasks/:id/subtasks` | `{ text }` |
| `PATCH` / `DELETE` | `/api/subtasks/:id` | `{ text?, done?, position? }` |

### Notas

| Método | Ruta | Cuerpo / notas |
| --- | --- | --- |
| `GET` | `/api/daily-notes?until=&limit=&q=` | Notas diarias, de la más reciente a la más antigua. |
| `GET` | `/api/daily-notes/:fecha?create=1` | Nota de ese día; con `create=1` la crea en blanco si no existe. |
| `PUT` | `/api/daily-notes/:fecha` | `{ content }` (crea o actualiza). |
| `GET` / `POST` | `/api/folders` | `POST { name, color? }` |
| `PATCH` / `DELETE` | `/api/folders/:id` | Al borrar una carpeta, sus notas quedan "Sin carpeta". |
| `GET` | `/api/notes?folderId=&q=` | Notas libres. |
| `POST` | `/api/notes` | `{ title?, content?, folderId? }` |
| `PATCH` / `DELETE` | `/api/notes/:id` | `{ title?, content?, folderId? }` |

### Hábitos

| Método | Ruta | Cuerpo / notas |
| --- | --- | --- |
| `GET` | `/api/habits?from=&to=` | Hábitos con `done: [fechas cumplidas]` dentro del rango. |
| `POST` | `/api/habits` | `{ name }` |
| `PATCH` / `DELETE` | `/api/habits/:id` | `{ name?, position? }`. `DELETE` borra también su historial. |
| `PUT` | `/api/habits/:id/logs` | `{ date, done }`: marca o desmarca un día (no permite días futuros). |

### Calendario

| Método | Ruta | Cuerpo / notas |
| --- | --- | --- |
| `GET` / `POST` | `/api/event-categories` | `POST { name, color? }` |
| `PATCH` / `DELETE` | `/api/event-categories/:id` | Sus eventos quedan sin categoría. |
| `GET` | `/api/events?from=&to=` | Eventos que pueden caer en el rango, incluidos los repetidos. El cliente calcula las repeticiones con `src/lib/recurrence.ts`. |
| `POST` | `/api/events` | `{ title, startDate, endDate?, allDay?, startTime?, endTime?, repeat?: nunca\|diario\|semanal\|mensual\|anual, categoryId?, place?, description? }` |
| `GET` / `PATCH` / `DELETE` | `/api/events/:id` | `PATCH` con cualquier campo; en eventos repetidos aplica a todas las repeticiones. |
| `GET` | `/api/search?q=` | Búsqueda en tareas, notas, diario y eventos. |

Ejemplo con `curl`:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"tu@correo.com","password":"tu-contraseña"}' http://localhost:8080/api/auth/login

curl -b cookies.txt http://localhost:8080/api/tasks
```

---

## Solución de problemas

| Problema | Causa probable y solución |
| --- | --- |
| `Define POSTGRES_PASSWORD en el archivo .env` o `Define AUTH_SECRET…` | Falta el archivo `.env` o esas variables están vacías. Ver [paso 3](#3-configurar-las-variables-de-entorno). |
| Inicio sesión y me regresa al login | `COOKIE_SECURE=true` pero entras por `http://`. Ponlo en `false` o entra por HTTPS, y reinicia con `docker compose up -d`. |
| `password authentication failed for user "krono"` | Cambiaste `POSTGRES_PASSWORD` después del primer arranque. Regresa a la contraseña original o cámbiala dentro de la base (ver [Variables de entorno](#variables-de-entorno)). |
| No abre desde otra computadora | Revisa la IP (`hostname -I`), que ambas estén en la misma red y el firewall (`sudo ufw status`). |
| El puerto 8080 ya está en uso | Cambia `WEB_PORT=8081` (u otro) en `.env` y ejecuta `docker compose up -d`. |
| `docker: permission denied` | Agrega tu usuario al grupo docker (`sudo usermod -aG docker $USER`) y vuelve a iniciar sesión. |
| `!override` no reconocido al usar Caddy | Tu Docker Compose es viejo. Actualiza con `sudo apt install docker-compose-plugin` (necesitas 2.24 o mayor). |
| Caddy no obtiene el certificado | El dominio no apunta a tu IP pública o los puertos 80/443 no están reenviados en el router. Revisa `docker compose logs caddy`. |
| La app no arranca después de actualizar | Revisa `docker compose logs web`. Si falló una migración, restaura el respaldo previo con `./scripts/restore.sh`. |
| Olvidé mi contraseña | Crea un hash nuevo y guárdalo en la base (siguiente bloque). |

Restablecer una contraseña desde la terminal:

```bash
# 1. Genera el hash de la nueva contraseña (cambia NuevaContraseña123)
HASH=$(docker run --rm node:22-alpine sh -c \
  "cd /tmp && npm i -s bcryptjs >/dev/null 2>&1 && node -e \"require('bcryptjs').hash(process.argv[1],12).then(console.log)\" 'NuevaContraseña123'")

# 2. Guárdalo en tu usuario (cambia el correo)
docker compose exec db psql -U krono -d krono -c "UPDATE users SET password_hash='$HASH' WHERE email='tu@correo.com';"
```

---

## Subir el proyecto a GitHub

Desde la carpeta del proyecto (en tu computadora):

```bash
git init
git add .
git commit -m "Krono: primera versión"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/krono.git
git push -u origin main
```

`.gitignore` ya excluye `node_modules/`, `.next/`, `.env` y `backups/`. Antes del primer push, comprueba que `.env` no aparezca:

```bash
git status --ignored | grep .env   # debe aparecer solo en "Ignored files"
```

Se recomienda que el repositorio sea **privado**.
