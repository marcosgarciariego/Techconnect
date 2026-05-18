export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <a href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="text-xl font-bold text-gray-900">TechConnect</span>
            </a>
            <p className="mt-4 text-sm text-gray-500 max-w-md">
              La plataforma que conecta clientes con profesionales de tecnología.
              Encuentra el talento que necesitas o muestra tus servicios.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Plataforma</h3>
            <ul className="space-y-3">
              <li>
                <a href="/anuncios" className="text-sm text-gray-500 hover:text-gray-900">
                  Explorar anuncios
                </a>
              </li>
              <li>
                <a href="/register" className="text-sm text-gray-500 hover:text-gray-900">
                  Registrarse
                </a>
              </li>
              <li>
                <a href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                  Iniciar sesión
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Legal</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Términos de uso
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Privacidad
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Cookies
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-400 text-center">
            &copy; {currentYear} TechConnect. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
