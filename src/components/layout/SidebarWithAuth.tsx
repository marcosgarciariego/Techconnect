import { AuthProvider } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';

interface SidebarWithAuthProps {
  currentPath?: string;
}

export function SidebarWithAuth({ currentPath = '' }: SidebarWithAuthProps) {
  return (
    <AuthProvider>
      <Sidebar currentPath={currentPath} />
    </AuthProvider>
  );
}
