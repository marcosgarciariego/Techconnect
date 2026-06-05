# TechConnect

**Plataforma de conexión entre clientes y profesionales de tecnología**

TechConnect es una aplicación web moderna que conecta a clientes que necesitan servicios informáticos con profesionales que los ofrecen. Similar a plataformas como Upwork o Fiverr, pero enfocada en el mercado hispanohablante de servicios tecnológicos.

## Características principales

### Para clientes
- Publicar anuncios de necesidades tecnológicas
- Recibir y gestionar candidaturas de profesionales
- Chat en tiempo real con profesionales
- Crear órdenes de servicio
- Dejar valoraciones tras completar servicios

### Para profesionales
- Explorar anuncios disponibles
- Enviar candidaturas con propuestas
- Gestionar perfil profesional
- Comunicarse con clientes por chat
- Recibir valoraciones

### Funcionalidades generales
- Sistema de autenticación seguro (JWT + cookies httpOnly)
- Roles: client, professional, admin
- Favoritos de anuncios
- Notificaciones internas
- Chat en tiempo real (WebSockets)
- Panel de administración

## Stack tecnológico

- **Frontend**: [Astro](https://astro.build/) + [React](https://reactjs.org/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend API**: [Express.js](https://expressjs.com/)
- **Base de datos**: MySQL 8.0
- **ORM**: [Prisma](https://www.prisma.io/)
- **Chat en tiempo real**: [Socket.IO](https://socket.io/)
- **Validación**: [Zod](https://zod.dev/)
- **Autenticación**: JWT + bcrypt
- **Lenguaje**: TypeScript

## Requisitos previos

- Node.js >= 20.0.0
- MySQL 8.0+
- npm o yarn

## Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd techconnect
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y configura tus variables:

```bash
cp .env.example .env
```

Edita el archivo `.env`:

```env
# Database - desarrollo local
DATABASE_URL="mysql://usuario:password@localhost:3306/techconnect"
#
# Database - produccion/Vercel
# Usa una MySQL online, nunca localhost:
# DATABASE_URL="mysql://usuario:password@host-publico:3306/techconnect"

# JWT Secret - Genera una clave segura para producción
JWT_SECRET="tu-clave-secreta-muy-larga-y-segura"
JWT_EXPIRES_IN="7d"

# Server
SERVER_PORT=3001
NODE_ENV="development"

# Frontend URL (para CORS)
FRONTEND_URL="http://localhost:4321"

# API URL (para el frontend)
# En Vercel produccion usa PUBLIC_API_URL="/api"
PUBLIC_API_URL="http://localhost:3001/api"
PUBLIC_SOCKET_URL="http://localhost:3001"
```

### 4. Crear la base de datos

Opción A: Usar Prisma (recomendado)
```bash
# Generar cliente de Prisma
npm run db:generate

# Aplicar schema a la base de datos
npm run db:push
```

Opción B: Ejecutar el SQL manualmente en MySQL

### 4.1. Usar una base de datos online en Vercel

Para que la web desplegada funcione, crea una base MySQL online compatible con Prisma. Opciones validas: Railway MySQL, PlanetScale, TiDB Cloud, Aiven MySQL o cualquier hosting MySQL con host publico.

Cuando el proveedor te de la URL de conexion, debe tener este formato:

```env
DATABASE_URL="mysql://usuario:password@host-publico:3306/techconnect"
```

No uses `localhost`, `127.0.0.1` ni el nombre de tu PC en Vercel.

En Vercel, en `Settings > Environment Variables`, anade estas variables en `Production` y, si usas despliegues de prueba, tambien en `Preview`:

```env
DATABASE_URL="mysql://usuario:password@host-publico:3306/techconnect"
JWT_SECRET="una_clave_larga_random_de_32_o_mas_caracteres"
JWT_EXPIRES_IN="7d"
PUBLIC_API_URL="/api"
```

Despues de guardar las variables, crea las tablas y datos demo en la base online desde tu terminal:

```powershell
$env:DATABASE_URL="mysql://usuario:password@host-publico:3306/techconnect"
npm run db:deploy
npm run db:seed
```

Para ver la base online en Prisma Studio:

```powershell
$env:DATABASE_URL="mysql://usuario:password@host-publico:3306/techconnect"
npm run db:studio
```

Luego haz `Redeploy` en Vercel y comprueba:

```text
https://tu-dominio.vercel.app/api/health
https://tu-dominio.vercel.app/api/ads
```

### 5. Poblar con datos de prueba (opcional pero recomendado)

```bash
npm run db:seed
```

Esto creará:
- Roles: client, professional, admin
- Categorías de servicios
- Usuarios de prueba
- Anuncios de ejemplo

### 6. Iniciar la aplicación

```bash
# Modo desarrollo (frontend + backend)
npm run dev
```

Esto iniciará:
- Frontend Astro: http://localhost:4321
- Backend API: http://localhost:3001

## Credenciales de prueba

Después de ejecutar el seed:

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@techconnect.com | password123 |
| Cliente | cliente.demo@techconnect.com | password123 |
| Profesional | profesional.demo@techconnect.com | password123 |
| Cliente 2 | marta.cliente@techconnect.com | password123 |
| Profesional 2 | ana.pro@techconnect.com | password123 |

## Estructura del proyecto

```
techconnect/
├── prisma/
│   ├── schema.prisma      # Schema de base de datos
│   └── seed.ts            # Script de datos de prueba
├── server/
│   ├── config/            # Configuración DB
│   ├── middleware/        # Auth, roles, errores
│   ├── routes/            # Endpoints API
│   ├── services/          # Lógica de negocio
│   ├── socket/            # Handlers de WebSocket
│   ├── types/             # Tipos TypeScript
│   ├── utils/             # Validaciones Zod
│   └── index.ts           # Servidor Express
├── src/
│   ├── components/        # Componentes React
│   │   ├── ui/           # Componentes UI base
│   │   ├── layout/       # Header, Footer, Sidebar
│   │   ├── auth/         # Login, Register forms
│   │   ├── ads/          # Componentes de anuncios
│   │   └── ...
│   ├── context/          # AuthContext
│   ├── hooks/            # useAuth, useSocket
│   ├── layouts/          # Layouts Astro
│   ├── lib/              # API client, utilidades
│   ├── pages/            # Páginas Astro
│   └── styles/           # CSS global
├── public/               # Assets estáticos
├── .env.example          # Variables de entorno ejemplo
├── astro.config.mjs      # Config Astro
├── tailwind.config.mjs   # Config Tailwind
├── tsconfig.json         # Config TypeScript
└── package.json
```

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia frontend y backend en desarrollo |
| `npm run dev:astro` | Solo frontend Astro |
| `npm run dev:server` | Solo backend Express |
| `npm run build` | Compila para producción |
| `npm run db:generate` | Genera cliente Prisma |
| `npm run db:push` | Aplica schema a DB |
| `npm run db:deploy` | Aplica schema a una DB online configurada en `DATABASE_URL` |
| `npm run db:deploy:seed` | Aplica schema y carga datos demo en la DB configurada |
| `npm run db:migrate` | Crea migración |
| `npm run db:seed` | Ejecuta seed de datos |
| `npm run db:studio` | Abre Prisma Studio |

## API Endpoints principales

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Inicio de sesión
- `POST /api/auth/logout` - Cierre de sesión
- `GET /api/auth/me` - Usuario actual

### Usuarios
- `GET /api/users/profile` - Perfil propio
- `PUT /api/users/profile` - Actualizar perfil
- `GET /api/users/:id` - Perfil público

### Anuncios
- `GET /api/ads` - Listar con filtros
- `GET /api/ads/:id` - Detalle
- `POST /api/ads` - Crear
- `PUT /api/ads/:id` - Actualizar
- `DELETE /api/ads/:id` - Eliminar

### Candidaturas
- `POST /api/applications` - Enviar candidatura
- `GET /api/applications/professional/mine` - Mis candidaturas
- `GET /api/applications/received/mine` - Recibidas
- `PATCH /api/applications/:id/status` - Actualizar estado

### Órdenes
- `POST /api/orders` - Crear orden
- `GET /api/orders/:id` - Detalle
- `PATCH /api/orders/:id/status` - Actualizar estado

### Conversaciones
- `GET /api/conversations` - Listar
- `GET /api/conversations/:id` - Mensajes
- `POST /api/conversations/:id/messages` - Enviar mensaje

### Favoritos
- `GET /api/favorites` - Mis favoritos
- `POST /api/favorites/:adId/toggle` - Toggle favorito

### Valoraciones
- `POST /api/reviews` - Crear valoración
- `GET /api/reviews/user/:userId` - Valoraciones de usuario

## Flujo de negocio

1. **Registro**: Usuario se registra como `client` o `professional`
2. **Publicar anuncio**: Cliente crea anuncio con requisitos
3. **Candidaturas**: Profesionales aplican a anuncios
4. **Selección**: Cliente acepta una candidatura
5. **Orden**: Se crea orden de servicio
6. **Chat**: Comunicación en tiempo real
7. **Completar**: Se marca orden como completada
8. **Valoración**: Ambas partes pueden dejar reviews

## Seguridad

- Contraseñas hasheadas con bcrypt (10 rounds)
- JWT almacenado en cookies httpOnly
- Validación de datos con Zod
- Control de acceso por roles
- Protección de rutas privadas
- Queries parametrizadas (Prisma)

## Diseño

- Paleta: Blanco + Azul primario
- Estilo minimalista y moderno
- Responsive (mobile-first)
- Componentes reutilizables
- Tipografía: Inter

## Desarrollo

### Añadir nuevas rutas

1. Crear servicio en `server/services/`
2. Crear ruta en `server/routes/`
3. Registrar en `server/index.ts`

### Añadir componentes

1. Crear en `src/components/`
2. Usar client:load para interactividad

### Modificar base de datos

1. Editar `prisma/schema.prisma`
2. Ejecutar `npm run db:migrate`

## Licencia

Este proyecto es parte de un TFG (Trabajo Fin de Grado).

---

**TechConnect** - Conectando talento con oportunidades
