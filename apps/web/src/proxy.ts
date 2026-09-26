import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Verifica el token real que envía NestJS en las cookies (accessToken o refreshToken)
  const token = request.cookies.get('accessToken')?.value || request.cookies.get('refreshToken')?.value;
  const { pathname } = request.nextUrl;

  // Definimos rutas públicas
  const isAuthRoute = pathname === '/login' || pathname === '/register';
  
  // 1. Si accede a la raíz de la web, redirigimos dependiendo de su sesión
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Si NO hay sesión y la ruta NO es pública, expulsar a /login
  if (!token && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Si SÍ hay sesión y trata de entrar a /login o /register, forzar al dashboard
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configurar en qué rutas se debe ejecutar este middleware
export const config = {
  matcher: [
    /*
     * Ignorar llamadas internas de Next.js y archivos estáticos:
     * - api (rutas de API de Next, si hubiera)
     * - _next/static (archivos JS/CSS estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
