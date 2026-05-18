import type { ReactNode } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { Header } from './Header';
import { Footer } from './Footer';

interface AppShellProps {
  children?: ReactNode;
  currentPath?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function AppShell({
  children,
  currentPath = '',
  showHeader = true,
  showFooter = true
}: AppShellProps) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        {showHeader && <Header currentPath={currentPath} />}
        <div className="flex-1">
          {children}
        </div>
        {showFooter && <Footer />}
      </div>
    </AuthProvider>
  );
}

// Componente para páginas públicas con contenido estático
interface PublicPageShellProps {
  currentPath?: string;
}

export function PublicPageShell({ currentPath = '' }: PublicPageShellProps) {
  return (
    <AuthProvider>
      <Header currentPath={currentPath} />
    </AuthProvider>
  );
}
