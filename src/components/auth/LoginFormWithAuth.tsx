import { AuthProvider } from '../../context/AuthContext';
import { LoginForm } from './LoginForm';

interface LoginFormWithAuthProps {
  redirectTo?: string;
}

export function LoginFormWithAuth({ redirectTo }: LoginFormWithAuthProps) {
  return (
    <AuthProvider>
      <LoginForm redirectTo={redirectTo} />
    </AuthProvider>
  );
}
