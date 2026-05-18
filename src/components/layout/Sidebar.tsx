import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPath?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

export function Sidebar({ currentPath = '' }: SidebarProps) {
  const { user } = useAuth();
  const isProfessional = user?.roles.includes('professional');
  const isClient = user?.roles.includes('client');
  const roleLabel = isProfessional ? 'Ofreces servicios' : isClient ? 'Solicitas servicios' : 'Panel';
  const roleDescription = isProfessional
    ? 'Captacion, propuestas y trabajos'
    : 'Anuncios, candidaturas y ordenes';
  const rolePanelClass = isProfessional
    ? 'bg-emerald-50 text-emerald-900 ring-emerald-100'
    : 'bg-blue-50 text-blue-900 ring-blue-100';
  const activeLinkClass = isProfessional
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-blue-50 text-blue-700';

  const generalLinks: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      href: '/dashboard/perfil',
      label: 'Mi perfil',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      href: '/dashboard/favoritos',
      label: 'Favoritos',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    },
    {
      href: '/dashboard/notificaciones',
      label: 'Notificaciones',
      icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    },
    {
      href: '/dashboard/mensajes',
      label: 'Mensajes',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    },
  ];

  const clientLinks: NavItem[] = [
    {
      href: '/dashboard/cliente/anuncios',
      label: 'Mis anuncios',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      roles: ['client'],
    },
    {
      href: '/dashboard/cliente/nuevo-anuncio',
      label: 'Crear anuncio',
      icon: 'M12 4v16m8-8H4',
      roles: ['client'],
    },
    {
      href: '/dashboard/cliente/candidaturas',
      label: 'Candidaturas recibidas',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      roles: ['client'],
    },
    {
      href: '/dashboard/cliente/ordenes',
      label: 'Mis órdenes',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      roles: ['client'],
    },
  ];

  const professionalLinks: NavItem[] = [
    {
      href: '/dashboard/profesional/perfil',
      label: 'Perfil profesional',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      roles: ['professional'],
    },
    {
      href: '/dashboard/profesional/explorar',
      label: 'Explorar anuncios',
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
      roles: ['professional'],
    },
    {
      href: '/dashboard/profesional/candidaturas',
      label: 'Mis candidaturas',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      roles: ['professional'],
    },
    {
      href: '/dashboard/profesional/ordenes',
      label: 'Mis trabajos',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      roles: ['professional'],
    },
    {
      href: '/dashboard/profesional/valoraciones',
      label: 'Valoraciones',
      icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      roles: ['professional'],
    },
  ];

  const filterByRole = (links: NavItem[]) =>
    links.filter((link) => !link.roles || link.roles.some((role) => user?.roles.includes(role)));

  const isActive = (href: string) => currentPath === href;

  const renderLink = (item: NavItem) => (
    <a
      key={item.href}
      href={item.href}
      className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        isActive(item.href)
          ? activeLinkClass
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <svg
        className="h-5 w-5 mr-3 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      {item.label}
    </a>
  );

  const filteredClientLinks = filterByRole(clientLinks);
  const filteredProfessionalLinks = filterByRole(professionalLinks);

  return (
    <aside className="h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
      <nav className="p-4 space-y-6">
        <div className={`rounded-lg p-4 ring-1 ${rolePanelClass}`}>
          <p className="text-sm font-semibold">{roleLabel}</p>
          <p className="mt-1 text-xs opacity-75">{roleDescription}</p>
        </div>

        {/* General */}
        <div>
          <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            General
          </h3>
          <div className="space-y-1">{generalLinks.map(renderLink)}</div>
        </div>

        {/* Client section */}
        {filteredClientLinks.length > 0 && (
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Cliente
            </h3>
            <div className="space-y-1">{filteredClientLinks.map(renderLink)}</div>
          </div>
        )}

        {/* Professional section */}
        {filteredProfessionalLinks.length > 0 && (
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Profesional
            </h3>
            <div className="space-y-1">{filteredProfessionalLinks.map(renderLink)}</div>
          </div>
        )}
      </nav>
    </aside>
  );
}
