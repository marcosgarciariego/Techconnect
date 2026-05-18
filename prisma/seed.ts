import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * DAY);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY);
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function resetDatabase() {
  console.log('Resetting database...');

  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.applicationAttachment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.adImage.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.role.deleteMany();

  const tablesWithAutoIncrement = [
    'roles',
    'users',
    'professional_profiles',
    'categories',
    'ads',
    'ad_images',
    'applications',
    'application_attachments',
    'service_orders',
    'conversations',
    'messages',
    'reviews',
    'notifications',
    'audit_log',
  ];

  for (const table of tablesWithAutoIncrement) {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
  }
}

async function createCatalog() {
  await prisma.role.createMany({
    data: [
      {
        name: 'client',
        description: 'Usuario que publica necesidades o contrata servicios',
      },
      {
        name: 'professional',
        description: 'Usuario que ofrece servicios informaticos',
      },
      {
        name: 'admin',
        description: 'Administrador de la plataforma',
      },
    ],
  });

  await prisma.category.createMany({
    data: [
      {
        name: 'Desarrollo Web',
        description: 'Creacion y mantenimiento de paginas web',
      },
      {
        name: 'Desarrollo de Apps',
        description: 'Aplicaciones moviles y de escritorio',
      },
      {
        name: 'Diseno UX/UI',
        description: 'Diseno de interfaces y experiencia de usuario',
      },
      {
        name: 'Soporte Tecnico',
        description: 'Resolucion de incidencias y mantenimiento',
      },
      {
        name: 'Ciberseguridad',
        description: 'Auditoria, proteccion y seguridad informatica',
      },
      {
        name: 'SEO y Marketing Digital',
        description: 'Posicionamiento y estrategias digitales',
      },
      {
        name: 'Bases de Datos',
        description: 'Diseno, optimizacion y administracion de bases de datos',
      },
      {
        name: 'Automatizacion',
        description: 'Scripts, integraciones y automatizacion de procesos',
      },
    ],
  });

  const [clientRole, professionalRole, adminRole, categories] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: 'client' } }),
    prisma.role.findUniqueOrThrow({ where: { name: 'professional' } }),
    prisma.role.findUniqueOrThrow({ where: { name: 'admin' } }),
    prisma.category.findMany(),
  ]);

  return {
    clientRole,
    professionalRole,
    adminRole,
    categoryByName: new Map(categories.map((category) => [category.name, category])),
  };
}

async function createDemoConversation({
  adId,
  applicationId,
  orderId,
  participantIds,
  messages,
}: {
  adId?: bigint;
  applicationId?: bigint;
  orderId?: bigint;
  participantIds: bigint[];
  messages: Array<{
    senderUserId: bigint;
    body: string;
    minutesAgo: number;
    isRead?: boolean;
  }>;
}) {
  const conversation = await prisma.conversation.create({
    data: {
      adId,
      applicationId,
      orderId,
      participants: {
        create: participantIds.map((userId) => ({ userId })),
      },
    },
  });

  await prisma.message.createMany({
    data: messages.map((message) => ({
      conversationId: conversation.id,
      senderUserId: message.senderUserId,
      body: message.body,
      isRead: message.isRead ?? true,
      sentAt: minutesAgo(message.minutesAgo),
    })),
  });

  return conversation;
}

async function main() {
  await resetDatabase();

  console.log('Creating catalog data...');
  const { clientRole, professionalRole, adminRole, categoryByName } = await createCatalog();
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('Creating demo users...');

  const clientUser = await prisma.user.create({
    data: {
      fullName: 'Laura Navarro Ruiz',
      email: 'cliente.demo@techconnect.com',
      passwordHash,
      phone: '+34 611 245 830',
      city: 'Madrid',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      bio:
        'Fundadora de una empresa de formacion online. Busca profesionales tech para mejorar sus canales digitales y automatizar operaciones.',
      isActive: true,
      userRoles: {
        create: { roleId: clientRole.id },
      },
    },
  });

  const professionalUser = await prisma.user.create({
    data: {
      fullName: 'Diego Martin Serrano',
      email: 'profesional.demo@techconnect.com',
      passwordHash,
      phone: '+34 622 419 775',
      city: 'Valencia',
      avatarUrl:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
      bio:
        'Desarrollador full-stack y consultor tecnico. Especializado en React, Node.js, integraciones de pago y automatizacion para pymes.',
      isActive: true,
      userRoles: {
        create: { roleId: professionalRole.id },
      },
      professionalProfile: {
        create: {
          description:
            'Construyo productos web completos, paneles internos e integraciones robustas. Trabajo con entregas semanales, documentacion clara y soporte despues del lanzamiento.',
          yearsExperience: 9,
          hourlyRate: 48.0,
          portfolioUrl: 'https://github.com/diegomartin-tech',
          availability: 'freelance',
          verified: true,
        },
      },
    },
  });

  const martaClient = await prisma.user.create({
    data: {
      fullName: 'Marta Beltran Soria',
      email: 'marta.cliente@techconnect.com',
      passwordHash,
      phone: '+34 633 104 882',
      city: 'Bilbao',
      avatarUrl:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80',
      bio: 'Responsable de una clinica privada que necesita digitalizar reservas, clientes y comunicaciones.',
      userRoles: {
        create: { roleId: clientRole.id },
      },
    },
  });

  const javierClient = await prisma.user.create({
    data: {
      fullName: 'Javier Pardo Molina',
      email: 'javier.cliente@techconnect.com',
      passwordHash,
      phone: '+34 644 712 309',
      city: 'Sevilla',
      avatarUrl:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
      bio: 'Dirige una distribuidora local y busca soluciones para analitica, inventario y ventas online.',
      userRoles: {
        create: { roleId: clientRole.id },
      },
    },
  });

  const sofiaClient = await prisma.user.create({
    data: {
      fullName: 'Sofia Campos Vidal',
      email: 'sofia.cliente@techconnect.com',
      passwordHash,
      phone: '+34 655 330 814',
      city: 'Malaga',
      avatarUrl:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
      bio: 'Coordina una agencia turistica y necesita mejorar web, posicionamiento y herramientas internas.',
      userRoles: {
        create: { roleId: clientRole.id },
      },
    },
  });

  const anaProfessional = await prisma.user.create({
    data: {
      fullName: 'Ana Sanchez Perez',
      email: 'ana.pro@techconnect.com',
      passwordHash,
      phone: '+34 666 819 402',
      city: 'Sevilla',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      bio: 'Disenadora UX/UI centrada en productos digitales educativos, SaaS y apps moviles.',
      userRoles: {
        create: { roleId: professionalRole.id },
      },
      professionalProfile: {
        create: {
          description:
            'Realizo auditorias UX, prototipos navegables, sistemas visuales y pruebas de usabilidad para equipos pequenos.',
          yearsExperience: 6,
          hourlyRate: 38.0,
          portfolioUrl: 'https://behance.net/anasanchezux',
          availability: 'part-time',
          verified: true,
        },
      },
    },
  });

  const carlosProfessional = await prisma.user.create({
    data: {
      fullName: 'Carlos Rivas Ortega',
      email: 'carlos.seguridad@techconnect.com',
      passwordHash,
      phone: '+34 677 284 118',
      city: 'Granada',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      bio: 'Consultor de ciberseguridad y hardening de aplicaciones web.',
      userRoles: {
        create: { roleId: professionalRole.id },
      },
      professionalProfile: {
        create: {
          description:
            'Hago auditorias web, revision de dependencias, configuracion segura de servidores e informes con prioridades claras.',
          yearsExperience: 11,
          hourlyRate: 62.0,
          portfolioUrl: 'https://carlosrivas.dev',
          availability: 'freelance',
          verified: true,
        },
      },
    },
  });

  const paulaProfessional = await prisma.user.create({
    data: {
      fullName: 'Paula Gomez Herrero',
      email: 'paula.datos@techconnect.com',
      passwordHash,
      phone: '+34 688 592 741',
      city: 'Zaragoza',
      avatarUrl:
        'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=256&q=80',
      bio: 'Especialista en datos, automatizaciones y cuadros de mando para pymes.',
      userRoles: {
        create: { roleId: professionalRole.id },
      },
      professionalProfile: {
        create: {
          description:
            'Conecto formularios, CRM, hojas de calculo, bases de datos y dashboards para reducir trabajo manual.',
          yearsExperience: 7,
          hourlyRate: 44.0,
          portfolioUrl: 'https://paulagomezdata.com',
          availability: 'freelance',
          verified: false,
        },
      },
    },
  });

  const rubenProfessional = await prisma.user.create({
    data: {
      fullName: 'Ruben Torres Alba',
      email: 'ruben.marketing@techconnect.com',
      passwordHash,
      phone: '+34 699 120 663',
      city: 'Alicante',
      avatarUrl:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
      bio: 'Consultor SEO tecnico y marketing digital para negocios locales y ecommerce.',
      userRoles: {
        create: { roleId: professionalRole.id },
      },
      professionalProfile: {
        create: {
          description:
            'Trabajo auditorias SEO, estrategia de contenidos, analitica y optimizacion de conversion en webs de servicios.',
          yearsExperience: 8,
          hourlyRate: 42.0,
          portfolioUrl: 'https://rubentorresseo.com',
          availability: 'part-time',
          verified: true,
        },
      },
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      fullName: 'Administrador TechConnect',
      email: 'admin@techconnect.com',
      passwordHash,
      phone: '+34 600 000 000',
      city: 'Madrid',
      avatarUrl:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=80',
      bio: 'Cuenta de administracion para revisar usuarios, categorias y anuncios.',
      userRoles: {
        create: { roleId: adminRole.id },
      },
    },
  });

  console.log('Creating demo ads with images...');

  const webAd = await prisma.ad.create({
    data: {
      userId: clientUser.id,
      categoryId: categoryByName.get('Desarrollo Web')!.id,
      title: 'Tienda online profesional para academia de cursos',
      description:
        'Necesito una tienda online moderna para vender cursos digitales y packs de formacion. Debe incluir catalogo, fichas de curso, carrito, pago con tarjeta, area basica de alumnos, emails transaccionales y panel para gestionar pedidos. Valoro SEO tecnico, analitica y documentacion para mantener contenidos sin depender siempre del desarrollador.',
      budgetMin: 2400.0,
      budgetMax: 4200.0,
      modality: 'hibrido',
      location: 'Madrid',
      status: 'active',
      publishedAt: daysAgo(5),
      expiresAt: daysFromNow(40),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const appAd = await prisma.ad.create({
    data: {
      userId: clientUser.id,
      categoryId: categoryByName.get('Desarrollo de Apps')!.id,
      title: 'App movil de reservas para talleres presenciales',
      description:
        'Busco desarrollar una app sencilla para que alumnos consulten talleres disponibles, reserven plaza, reciban recordatorios y guarden su historial. Puede empezar con una primera version en React Native o tecnologia similar. Necesito login, notificaciones y una pequena zona de administracion para publicar nuevos talleres.',
      budgetMin: 5200.0,
      budgetMax: 8500.0,
      modality: 'online',
      location: 'Remoto',
      status: 'active',
      publishedAt: daysAgo(3),
      expiresAt: daysFromNow(35),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const uxAd = await prisma.ad.create({
    data: {
      userId: clientUser.id,
      categoryId: categoryByName.get('Diseno UX/UI')!.id,
      title: 'Rediseno UX/UI de plataforma de aprendizaje',
      description:
        'Queremos mejorar la experiencia de una plataforma de aprendizaje ya publicada. El objetivo es revisar arquitectura de informacion, simplificar el dashboard del alumno, mejorar la pagina de curso y entregar un prototipo navegable en Figma con sistema visual consistente. Se valorara experiencia en productos educativos.',
      budgetMin: 1200.0,
      budgetMax: 2600.0,
      modality: 'online',
      location: 'Remoto',
      status: 'active',
      publishedAt: daysAgo(2),
      expiresAt: daysFromNow(30),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const automationAd = await prisma.ad.create({
    data: {
      userId: clientUser.id,
      categoryId: categoryByName.get('Automatizacion')!.id,
      title: 'Automatizacion de facturas, leads y seguimiento comercial',
      description:
        'Necesito conectar formularios web, CRM, hojas de calculo y facturacion para reducir tareas manuales. El flujo ideal debe capturar leads, crear oportunidades, avisar al equipo, generar presupuestos y preparar facturas cuando se confirme el servicio. Busco una solucion mantenible, documentada y con pruebas.',
      budgetMin: 900.0,
      budgetMax: 1800.0,
      modality: 'hibrido',
      location: 'Madrid',
      status: 'active',
      publishedAt: daysAgo(1),
      expiresAt: daysFromNow(28),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const securityAd = await prisma.ad.create({
    data: {
      userId: clientUser.id,
      categoryId: categoryByName.get('Ciberseguridad')!.id,
      title: 'Auditoria de seguridad para web corporativa',
      description:
        'Busco una revision de seguridad de una web corporativa y su panel privado. Necesito informe de vulnerabilidades, prioridades, recomendaciones concretas y una sesion final para entender riesgos. El alcance incluye configuracion del servidor, formularios, autenticacion, dependencias y proteccion de datos.',
      budgetMin: 700.0,
      budgetMax: 1500.0,
      modality: 'online',
      location: 'Remoto',
      status: 'active',
      publishedAt: daysAgo(4),
      expiresAt: daysFromNow(25),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const clinicAd = await prisma.ad.create({
    data: {
      userId: martaClient.id,
      categoryId: categoryByName.get('Desarrollo Web')!.id,
      title: 'Portal de reservas online para clinica privada',
      description:
        'Queremos un portal responsive para que pacientes reserven citas, reciban confirmaciones y puedan consultar informacion previa. Necesitamos panel interno para agenda, profesionales y servicios, integracion con email y una base preparada para ampliar a pagos mas adelante.',
      budgetMin: 3200.0,
      budgetMax: 5600.0,
      modality: 'hibrido',
      location: 'Bilbao',
      status: 'active',
      publishedAt: daysAgo(6),
      expiresAt: daysFromNow(45),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const clinicSeoAd = await prisma.ad.create({
    data: {
      userId: martaClient.id,
      categoryId: categoryByName.get('SEO y Marketing Digital')!.id,
      title: 'SEO local para clinica y campanas de captacion',
      description:
        'Buscamos mejorar el posicionamiento local de la clinica, optimizar Google Business Profile, crear contenidos de servicios y medir conversiones. Queremos un plan de tres meses con acciones concretas, analitica y seguimiento mensual.',
      budgetMin: 600.0,
      budgetMax: 1300.0,
      modality: 'online',
      location: 'Bilbao',
      status: 'active',
      publishedAt: daysAgo(7),
      expiresAt: daysFromNow(35),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1432888622747-4eb9a8f5a70d?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const dashboardAd = await prisma.ad.create({
    data: {
      userId: javierClient.id,
      categoryId: categoryByName.get('Bases de Datos')!.id,
      title: 'Dashboard de ventas e inventario conectado a ERP',
      description:
        'Necesitamos un cuadro de mando para ventas, rotacion de stock, margenes y alertas de productos bajos. Tenemos datos en un ERP y hojas de calculo. Buscamos una solucion con actualizacion diaria, filtros por tienda y exportacion a Excel.',
      budgetMin: 1800.0,
      budgetMax: 3400.0,
      modality: 'online',
      location: 'Sevilla',
      status: 'active',
      publishedAt: daysAgo(8),
      expiresAt: daysFromNow(38),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const ecommerceAd = await prisma.ad.create({
    data: {
      userId: javierClient.id,
      categoryId: categoryByName.get('Desarrollo Web')!.id,
      title: 'Migracion de catalogo B2B a ecommerce moderno',
      description:
        'Queremos migrar un catalogo B2B antiguo a una plataforma moderna con buscador, filtros avanzados, solicitud de presupuesto y cuentas de cliente. Debe mantenerse el SEO actual y permitir importar productos desde CSV.',
      budgetMin: 4500.0,
      budgetMax: 7800.0,
      modality: 'hibrido',
      location: 'Sevilla',
      status: 'active',
      publishedAt: daysAgo(11),
      expiresAt: daysFromNow(42),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const tourismWebAd = await prisma.ad.create({
    data: {
      userId: sofiaClient.id,
      categoryId: categoryByName.get('Desarrollo Web')!.id,
      title: 'Web multidioma para agencia de tours locales',
      description:
        'Necesitamos renovar la web de una agencia de tours en Malaga. Debe ser multidioma, rapida, editable, con integracion de reservas externas, landing pages para rutas y medicion de conversiones. Nos interesa especialmente que funcione muy bien en movil.',
      budgetMin: 2200.0,
      budgetMax: 3900.0,
      modality: 'online',
      location: 'Malaga',
      status: 'active',
      publishedAt: daysAgo(9),
      expiresAt: daysFromNow(32),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const supportAd = await prisma.ad.create({
    data: {
      userId: sofiaClient.id,
      categoryId: categoryByName.get('Soporte Tecnico')!.id,
      title: 'Mantenimiento mensual de web y correos corporativos',
      description:
        'Buscamos soporte tecnico recurrente para mantener WordPress actualizado, revisar copias de seguridad, resolver incidencias de correo y hacer pequenas mejoras. Necesitamos respuesta rapida y un informe mensual de tareas.',
      budgetMin: 250.0,
      budgetMax: 600.0,
      modality: 'online',
      location: 'Malaga',
      status: 'active',
      publishedAt: daysAgo(12),
      expiresAt: daysFromNow(50),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1581090700227-1e37b190418e?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const crmAd = await prisma.ad.create({
    data: {
      userId: martaClient.id,
      categoryId: categoryByName.get('Automatizacion')!.id,
      title: 'Integracion CRM con WhatsApp y recordatorios de cita',
      description:
        'Queremos centralizar contactos de pacientes, enviar recordatorios automaticos por email o WhatsApp y registrar el historial de comunicaciones. Necesitamos una solucion sencilla para recepcion, con permisos basicos y exportacion de datos.',
      budgetMin: 1100.0,
      budgetMax: 2300.0,
      modality: 'hibrido',
      location: 'Bilbao',
      status: 'active',
      publishedAt: daysAgo(10),
      expiresAt: daysFromNow(37),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const b2bSecurityAd = await prisma.ad.create({
    data: {
      userId: javierClient.id,
      categoryId: categoryByName.get('Ciberseguridad')!.id,
      title: 'Revision de seguridad para ecommerce B2B antes del lanzamiento',
      description:
        'Antes de publicar el nuevo portal B2B queremos revisar login, permisos de clientes, formularios, cabeceras de seguridad, copias de seguridad y configuracion del servidor. Necesitamos informe priorizado y una lista de acciones concretas.',
      budgetMin: 850.0,
      budgetMax: 1700.0,
      modality: 'online',
      location: 'Sevilla',
      status: 'active',
      publishedAt: daysAgo(13),
      expiresAt: daysFromNow(31),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const offlineRoutesAd = await prisma.ad.create({
    data: {
      userId: sofiaClient.id,
      categoryId: categoryByName.get('Desarrollo de Apps')!.id,
      title: 'App ligera para rutas turisticas con mapas offline',
      description:
        'Buscamos una app o PWA para que turistas puedan consultar rutas, puntos de interes y mapas offline durante visitas guiadas. Debe funcionar bien sin cobertura, permitir varios idiomas y guardar favoritos del viaje.',
      budgetMin: 3800.0,
      budgetMax: 6500.0,
      modality: 'online',
      location: 'Malaga',
      status: 'active',
      publishedAt: daysAgo(14),
      expiresAt: daysFromNow(44),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const reportingAd = await prisma.ad.create({
    data: {
      userId: clientUser.id,
      categoryId: categoryByName.get('Bases de Datos')!.id,
      title: 'Modelo de datos para alumnos, cursos y reporting mensual',
      description:
        'Tenemos datos repartidos entre formularios, hojas y la plataforma de cursos. Necesitamos unificar alumnos, compras, progreso y asistencia para generar informes mensuales de negocio y detectar cursos con baja finalizacion.',
      budgetMin: 1400.0,
      budgetMax: 2800.0,
      modality: 'online',
      location: 'Madrid',
      status: 'active',
      publishedAt: daysAgo(15),
      expiresAt: daysFromNow(36),
      images: {
        create: [
          {
            imageUrl:
              'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80',
            isMain: true,
            sortOrder: 1,
          },
          {
            imageUrl:
              'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80',
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const ads = [
    webAd,
    appAd,
    uxAd,
    automationAd,
    securityAd,
    clinicAd,
    clinicSeoAd,
    dashboardAd,
    ecommerceAd,
    tourismWebAd,
    supportAd,
    crmAd,
    b2bSecurityAd,
    offlineRoutesAd,
    reportingAd,
  ];

  console.log('Creating applications, orders, reviews, favorites and chats...');

  const webApplication = await prisma.application.create({
    data: {
      adId: webAd.id,
      professionalUserId: professionalUser.id,
      coverLetter:
        'Hola Laura, puedo ayudarte con la tienda online. He desarrollado proyectos parecidos con catalogo, pagos, automatizaciones de email y paneles de gestion. Propongo empezar por una reunion de alcance, cerrar el mapa de funcionalidades y entregar una primera version navegable en dos semanas.',
      proposedPrice: 3600.0,
      estimatedDays: 28,
      status: 'accepted',
      attachments: {
        create: [
          {
            fileName: 'propuesta-tienda-online.pdf',
            originalName: 'Propuesta tienda online TechConnect.pdf',
            mimeType: 'application/pdf',
            size: 248000,
            url: '/uploads/applications/propuesta-tienda-online.pdf',
          },
        ],
      },
    },
  });

  const uxApplication = await prisma.application.create({
    data: {
      adId: uxAd.id,
      professionalUserId: anaProfessional.id,
      coverLetter:
        'Hola Laura, puedo hacer una auditoria UX inicial y convertirla en prototipo de Figma con componentes reutilizables. Me centraria en el dashboard de alumno, pagina de curso y flujo de compra.',
      proposedPrice: 2100.0,
      estimatedDays: 18,
      status: 'pending',
    },
  });

  const securityApplication = await prisma.application.create({
    data: {
      adId: securityAd.id,
      professionalUserId: carlosProfessional.id,
      coverLetter:
        'Puedo realizar la auditoria con revision manual, escaneo de dependencias, checklist OWASP y recomendaciones priorizadas. Entregaria informe ejecutivo y sesion final.',
      proposedPrice: 1200.0,
      estimatedDays: 7,
      status: 'pending',
    },
  });

  const automationApplication = await prisma.application.create({
    data: {
      adId: automationAd.id,
      professionalUserId: paulaProfessional.id,
      coverLetter:
        'Mi propuesta es mapear el proceso comercial actual y conectar formularios, CRM y facturacion con trazabilidad de errores. Puedo entregar documentacion y video de uso.',
      proposedPrice: 1550.0,
      estimatedDays: 12,
      status: 'accepted',
    },
  });

  const clinicApplication = await prisma.application.create({
    data: {
      adId: clinicAd.id,
      professionalUserId: professionalUser.id,
      coverLetter:
        'Hola Marta, tengo experiencia en portales con agenda y confirmaciones. Plantearia una primera version con servicios, profesionales, reservas y emails automaticos.',
      proposedPrice: 4900.0,
      estimatedDays: 35,
      status: 'accepted',
    },
  });

  const dashboardApplication = await prisma.application.create({
    data: {
      adId: dashboardAd.id,
      professionalUserId: professionalUser.id,
      coverLetter:
        'Javier, puedo montar un pipeline sencillo para consolidar ERP y hojas de calculo, con dashboard de ventas, stock y margenes. Haria primero una prueba con datos anonimizados.',
      proposedPrice: 2850.0,
      estimatedDays: 20,
      status: 'pending',
    },
  });

  const tourismApplication = await prisma.application.create({
    data: {
      adId: tourismWebAd.id,
      professionalUserId: professionalUser.id,
      coverLetter:
        'Sofia, puedo renovar la web con foco en rendimiento movil, SEO, multidioma y conversion. Propongo un prototipo rapido antes de maquetar.',
      proposedPrice: 3300.0,
      estimatedDays: 24,
      status: 'pending',
    },
  });

  await prisma.application.createMany({
    data: [
      {
        adId: appAd.id,
        professionalUserId: anaProfessional.id,
        coverLetter:
          'Puedo colaborar en la definicion UX de la app antes del desarrollo para validar flujos de reserva y recordatorios.',
        proposedPrice: 1800.0,
        estimatedDays: 14,
        status: 'pending',
      },
      {
        adId: clinicSeoAd.id,
        professionalUserId: rubenProfessional.id,
        coverLetter:
          'Realizaria auditoria SEO local, optimizacion de fichas de servicios y medicion de llamadas/formularios.',
        proposedPrice: 1050.0,
        estimatedDays: 21,
        status: 'accepted',
      },
      {
        adId: ecommerceAd.id,
        professionalUserId: professionalUser.id,
        coverLetter:
          'Puedo liderar la migracion tecnica del catalogo, mantener URLs clave y preparar importacion CSV de productos.',
        proposedPrice: 6900.0,
        estimatedDays: 45,
        status: 'pending',
      },
      {
        adId: supportAd.id,
        professionalUserId: carlosProfessional.id,
        coverLetter:
          'Puedo cubrir mantenimiento, actualizaciones, backups y revisar configuracion de correo para reducir incidencias.',
        proposedPrice: 520.0,
        estimatedDays: 30,
        status: 'pending',
      },
      {
        adId: dashboardAd.id,
        professionalUserId: paulaProfessional.id,
        coverLetter:
          'Tengo experiencia en dashboards con datos de ventas e inventario. Recomiendo empezar por modelo de datos y KPIs.',
        proposedPrice: 2600.0,
        estimatedDays: 18,
        status: 'pending',
      },
    ],
  });

  const webOrder = await prisma.serviceOrder.create({
    data: {
      applicationId: webApplication.id,
      clientUserId: clientUser.id,
      professionalUserId: professionalUser.id,
      agreedPrice: 3600.0,
      startDate: daysFromNow(2),
      endDate: daysFromNow(30),
      status: 'active',
    },
  });

  const automationOrder = await prisma.serviceOrder.create({
    data: {
      applicationId: automationApplication.id,
      clientUserId: clientUser.id,
      professionalUserId: paulaProfessional.id,
      agreedPrice: 1550.0,
      startDate: daysAgo(9),
      endDate: daysFromNow(5),
      status: 'active',
    },
  });

  const clinicOrder = await prisma.serviceOrder.create({
    data: {
      applicationId: clinicApplication.id,
      clientUserId: martaClient.id,
      professionalUserId: professionalUser.id,
      agreedPrice: 4900.0,
      startDate: daysAgo(18),
      endDate: daysFromNow(14),
      status: 'active',
    },
  });

  const seoApplication = await prisma.application.findFirstOrThrow({
    where: {
      adId: clinicSeoAd.id,
      professionalUserId: rubenProfessional.id,
    },
  });

  const seoOrder = await prisma.serviceOrder.create({
    data: {
      applicationId: seoApplication.id,
      clientUserId: martaClient.id,
      professionalUserId: rubenProfessional.id,
      agreedPrice: 1050.0,
      startDate: daysAgo(45),
      endDate: daysAgo(8),
      status: 'completed',
    },
  });

  await prisma.review.createMany({
    data: [
      {
        orderId: seoOrder.id,
        reviewerUserId: martaClient.id,
        reviewedUserId: rubenProfessional.id,
        rating: 5,
        comment:
          'Ruben entrego una auditoria muy clara y ya hemos notado mejoras en llamadas desde Google. Muy recomendable.',
        createdAt: daysAgo(6),
      },
      {
        orderId: seoOrder.id,
        reviewerUserId: rubenProfessional.id,
        reviewedUserId: martaClient.id,
        rating: 5,
        comment: 'Cliente muy organizado, facilito accesos y validaciones rapidamente.',
        createdAt: daysAgo(5),
      },
      {
        orderId: clinicOrder.id,
        reviewerUserId: martaClient.id,
        reviewedUserId: professionalUser.id,
        rating: 4,
        comment:
          'Diego esta avanzando bien con el portal y mantiene comunicacion semanal. Proyecto aun en curso.',
        createdAt: daysAgo(2),
      },
    ],
  });

  await prisma.favorite.createMany({
    data: [
      { userId: professionalUser.id, adId: appAd.id },
      { userId: professionalUser.id, adId: ecommerceAd.id },
      { userId: professionalUser.id, adId: tourismWebAd.id },
      { userId: anaProfessional.id, adId: appAd.id },
      { userId: anaProfessional.id, adId: uxAd.id },
      { userId: paulaProfessional.id, adId: dashboardAd.id },
      { userId: rubenProfessional.id, adId: clinicSeoAd.id },
      { userId: carlosProfessional.id, adId: securityAd.id },
    ],
  });

  const mainConversation = await createDemoConversation({
    adId: webAd.id,
    applicationId: webApplication.id,
    orderId: webOrder.id,
    participantIds: [clientUser.id, professionalUser.id],
    messages: [
      {
        senderUserId: professionalUser.id,
        body:
          'Hola Laura, gracias por aceptar la candidatura. He revisado el anuncio y creo que podemos dejar una tienda muy solida si cerramos primero catalogo, pagos y emails.',
        minutesAgo: 500,
      },
      {
        senderUserId: clientUser.id,
        body:
          'Perfecto, Diego. Necesitamos vender cursos sueltos y packs. Tambien queremos que el alumno reciba automaticamente el acceso despues del pago.',
        minutesAgo: 492,
      },
      {
        senderUserId: professionalUser.id,
        body:
          'Tiene sentido. Lo plantearia en tres bloques: tienda y checkout, area de alumno y panel interno. El primer entregable podria ser el flujo completo de compra con un curso de prueba.',
        minutesAgo: 480,
      },
      {
        senderUserId: clientUser.id,
        body:
          'Me encaja. El miercoles puedo pasarte el logo, colores, textos de los cursos y acceso al dominio. La pasarela de pago sera Stripe.',
        minutesAgo: 468,
      },
      {
        senderUserId: professionalUser.id,
        body:
          'Genial. El jueves preparo un prototipo inicial y una lista de decisiones pendientes. Si todo esta correcto, empezamos desarrollo el lunes y hacemos revision semanal.',
        minutesAgo: 455,
      },
      {
        senderUserId: clientUser.id,
        body:
          'Adelante. Dejamos entonces el precio cerrado en 3.600 euros y objetivo de lanzamiento en cuatro semanas si no aparecen cambios grandes.',
        minutesAgo: 440,
      },
      {
        senderUserId: professionalUser.id,
        body:
          'Confirmado. Te envio hoy el resumen de alcance y manana te comparto el calendario con hitos, entregables y lo que necesito de vuestro equipo.',
        minutesAgo: 428,
        isRead: false,
      },
    ],
  });

  await createDemoConversation({
    adId: uxAd.id,
    applicationId: uxApplication.id,
    participantIds: [clientUser.id, anaProfessional.id],
    messages: [
      {
        senderUserId: anaProfessional.id,
        body:
          'Hola Laura, vi la plataforma educativa. Antes de redisenar, haria una auditoria rapida con cinco alumnos para detectar fricciones reales.',
        minutesAgo: 390,
      },
      {
        senderUserId: clientUser.id,
        body:
          'Me gusta el enfoque. El problema principal esta en que muchos usuarios no encuentran el progreso ni los materiales descargables.',
        minutesAgo: 382,
      },
      {
        senderUserId: anaProfessional.id,
        body:
          'Entonces centraria el primer sprint en dashboard, pagina de curso y navegacion. Te puedo entregar wireframes en 4 dias.',
        minutesAgo: 370,
      },
      {
        senderUserId: clientUser.id,
        body: 'Perfecto, reviso tu propuesta y te confirmo manana.',
        minutesAgo: 360,
        isRead: false,
      },
    ],
  });

  await createDemoConversation({
    adId: securityAd.id,
    applicationId: securityApplication.id,
    participantIds: [clientUser.id, carlosProfessional.id],
    messages: [
      {
        senderUserId: carlosProfessional.id,
        body:
          'Laura, para la auditoria necesitaria una cuenta de pruebas, URL del panel y saber si hay entorno staging.',
        minutesAgo: 310,
      },
      {
        senderUserId: clientUser.id,
        body:
          'Tenemos staging y puedo preparar una cuenta limitada. Nos preocupa especialmente el formulario de pago y los perfiles de alumno.',
        minutesAgo: 302,
      },
      {
        senderUserId: carlosProfessional.id,
        body:
          'Perfecto. El informe separaria riesgos criticos, medios y mejoras recomendadas para que sea facil priorizar.',
        minutesAgo: 288,
      },
    ],
  });

  await createDemoConversation({
    adId: automationAd.id,
    applicationId: automationApplication.id,
    orderId: automationOrder.id,
    participantIds: [clientUser.id, paulaProfessional.id],
    messages: [
      {
        senderUserId: paulaProfessional.id,
        body:
          'Ya he mapeado el flujo actual. Hay tres puntos donde se duplica trabajo: entrada de leads, presupuesto y factura.',
        minutesAgo: 250,
      },
      {
        senderUserId: clientUser.id,
        body:
          'Totalmente. Si conseguimos que el equipo no tenga que copiar datos entre herramientas, ya seria una mejora enorme.',
        minutesAgo: 242,
      },
      {
        senderUserId: paulaProfessional.id,
        body:
          'Voy a preparar un prototipo con Make y una copia de la hoja actual. Manana lo validamos con dos casos reales.',
        minutesAgo: 230,
        isRead: false,
      },
    ],
  });

  await createDemoConversation({
    adId: clinicAd.id,
    applicationId: clinicApplication.id,
    orderId: clinicOrder.id,
    participantIds: [martaClient.id, professionalUser.id],
    messages: [
      {
        senderUserId: professionalUser.id,
        body:
          'Hola Marta, ya tengo el esquema del portal: servicios, profesionales, reservas y emails automaticos. Te comparto una demo esta tarde.',
        minutesAgo: 190,
      },
      {
        senderUserId: martaClient.id,
        body:
          'Genial. Necesitamos que cada profesional pueda bloquear horas no disponibles y que recepcion vea todo en calendario semanal.',
        minutesAgo: 178,
      },
      {
        senderUserId: professionalUser.id,
        body:
          'Lo incluyo en la primera version. Tambien dejare perfiles de usuario para recepcion y administracion.',
        minutesAgo: 165,
      },
      {
        senderUserId: martaClient.id,
        body: 'Perfecto, si la demo va bien empezamos a cargar servicios reales el viernes.',
        minutesAgo: 150,
        isRead: false,
      },
    ],
  });

  await createDemoConversation({
    adId: dashboardAd.id,
    applicationId: dashboardApplication.id,
    participantIds: [javierClient.id, professionalUser.id],
    messages: [
      {
        senderUserId: professionalUser.id,
        body:
          'Javier, antes de cerrar presupuesto necesito ver una muestra del ERP y confirmar si podemos exportar ventas por dia y producto.',
        minutesAgo: 135,
      },
      {
        senderUserId: javierClient.id,
        body:
          'Puedo pasarte un CSV anonimizado. Nos interesa especialmente margen por familia y alertas de stock bajo.',
        minutesAgo: 126,
      },
      {
        senderUserId: professionalUser.id,
        body:
          'Con eso puedo preparar un primer dashboard de prueba en 48 horas y validar si el modelo de datos encaja.',
        minutesAgo: 112,
      },
    ],
  });

  await createDemoConversation({
    adId: tourismWebAd.id,
    applicationId: tourismApplication.id,
    participantIds: [sofiaClient.id, professionalUser.id],
    messages: [
      {
        senderUserId: professionalUser.id,
        body:
          'Sofia, he revisado la web actual. La mayor oportunidad esta en rendimiento movil y paginas especificas por tour.',
        minutesAgo: 88,
      },
      {
        senderUserId: sofiaClient.id,
        body:
          'Si, la mayoria entra desde movil y queremos mejorar conversion en rutas de fin de semana.',
        minutesAgo: 80,
      },
      {
        senderUserId: professionalUser.id,
        body:
          'Te propongo empezar por una landing de prueba, medir conversion y luego replicar la estructura al resto de rutas.',
        minutesAgo: 72,
        isRead: false,
      },
    ],
  });

  await createDemoConversation({
    adId: clinicSeoAd.id,
    applicationId: seoApplication.id,
    orderId: seoOrder.id,
    participantIds: [martaClient.id, rubenProfessional.id],
    messages: [
      {
        senderUserId: rubenProfessional.id,
        body:
          'Marta, ya esta cerrada la primera fase SEO. Dejo el informe con prioridades y cambios aplicados.',
        minutesAgo: 65,
      },
      {
        senderUserId: martaClient.id,
        body:
          'Lo hemos revisado y esta muy claro. Esta semana aplicaremos los textos nuevos para fisioterapia y nutricion.',
        minutesAgo: 58,
      },
      {
        senderUserId: rubenProfessional.id,
        body:
          'Perfecto. En dos semanas revisamos Search Console y decidimos el siguiente bloque de contenidos.',
        minutesAgo: 50,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: clientUser.id,
        title: 'Candidatura aceptada',
        body: `${professionalUser.fullName} ya puede empezar a trabajar en "${webAd.title}".`,
        type: 'application',
        isRead: false,
        createdAt: minutesAgo(420),
      },
      {
        userId: clientUser.id,
        title: 'Nueva propuesta recibida',
        body: `${anaProfessional.fullName} ha enviado una propuesta para "${uxAd.title}".`,
        type: 'application',
        isRead: false,
        createdAt: minutesAgo(360),
      },
      {
        userId: clientUser.id,
        title: 'Nuevo mensaje',
        body: `${paulaProfessional.fullName} ha enviado avances de automatizacion.`,
        type: 'message_new',
        isRead: false,
        createdAt: minutesAgo(230),
      },
      {
        userId: professionalUser.id,
        title: 'Nuevo pedido activo',
        body: `${clientUser.fullName} ha confirmado el trabajo por 3600 euros.`,
        type: 'order',
        isRead: false,
        createdAt: minutesAgo(425),
      },
      {
        userId: professionalUser.id,
        title: 'Candidatura pendiente',
        body: `${javierClient.fullName} esta revisando tu propuesta para el dashboard de ventas.`,
        type: 'application',
        isRead: false,
        createdAt: minutesAgo(112),
      },
      {
        userId: professionalUser.id,
        title: 'Nueva valoracion',
        body: `${martaClient.fullName} ha valorado tu trabajo en el portal de reservas.`,
        type: 'review',
        isRead: true,
        createdAt: daysAgo(2),
      },
      {
        userId: anaProfessional.id,
        title: 'Propuesta enviada',
        body: `Tu propuesta para "${uxAd.title}" esta pendiente de respuesta.`,
        type: 'application',
        isRead: true,
        createdAt: minutesAgo(355),
      },
      {
        userId: adminUser.id,
        title: 'Actividad demo creada',
        body: 'La base de datos contiene usuarios, anuncios, candidaturas, ordenes, mensajes y valoraciones.',
        type: 'system',
        isRead: false,
        createdAt: minutesAgo(30),
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'SEED',
        entityType: 'Database',
        details: 'Datos de demostracion cargados para presentacion TFG',
      },
      {
        userId: clientUser.id,
        action: 'CREATE',
        entityType: 'Ad',
        entityId: webAd.id,
        details: `Anuncio creado: ${webAd.title}`,
      },
      {
        userId: professionalUser.id,
        action: 'APPLY',
        entityType: 'Application',
        entityId: webApplication.id,
        details: `Candidatura enviada para: ${webAd.title}`,
      },
    ],
  });

  console.log('Database seeded successfully!');
  console.log('');
  console.log('Test credentials');
  console.log('Client main: cliente.demo@techconnect.com / password123');
  console.log('Professional main: profesional.demo@techconnect.com / password123');
  console.log('Admin: admin@techconnect.com / password123');
  console.log('Other clients: marta.cliente@techconnect.com, javier.cliente@techconnect.com, sofia.cliente@techconnect.com / password123');
  console.log('Other professionals: ana.pro@techconnect.com, carlos.seguridad@techconnect.com, paula.datos@techconnect.com, ruben.marketing@techconnect.com / password123');
  console.log('');
  console.log(`Users created: 10`);
  console.log(`Ads created: ${ads.length}`);
  console.log(`Main conversation created: ${mainConversation.id.toString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
