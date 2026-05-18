import type { ReactNode } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  currentPath?: string;
}

export function DashboardLayout({ children, currentPath = '' }: DashboardLayoutProps) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Header currentPath={currentPath} />
        <div className="flex min-h-0">
          <Sidebar currentPath={currentPath} />
          <main className="min-w-0 flex-1 p-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
