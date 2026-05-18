import { AuthProvider } from '../../context/AuthContext';
import { Header } from './Header';

interface HeaderWithAuthProps {
  currentPath?: string;
}

/**
 * Header envuelto con AuthProvider - úsalo con client:only="react" en Astro
 * para evitar errores de SSR con el contexto de autenticación.
 */
export function HeaderWithAuth({ currentPath = '' }: HeaderWithAuthProps) {
  return (
    <AuthProvider>
      <Header currentPath={currentPath} />
    </AuthProvider>
  );
}
