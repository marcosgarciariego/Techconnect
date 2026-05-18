import { AuthProvider } from '../../context/AuthContext';
import { RegisterForm } from './RegisterForm';

interface RegisterFormWithAuthProps {
  redirectTo?: string;
}

export function RegisterFormWithAuth({ redirectTo }: RegisterFormWithAuthProps) {
  return (
    <AuthProvider>
      <RegisterForm redirectTo={redirectTo} />
    </AuthProvider>
  );
}
