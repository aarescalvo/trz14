import type { NextConfig } from "next";
import os from "os";

// Obtener origins permitidos desde variable de entorno, con fallback para desarrollo
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.NEXT_PUBLIC_APP_URL;
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim());
  }
  // En desarrollo permitir localhost
  return [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
};

// Detectar dinámicamente todas las IPs de red local para evitar warnings cross-origin
// cuando se accede desde una IP que cambia (DHCP) o desde otra PC en la red local.
const getDevOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          origins.push(`http://${iface.address}:3000`);
          origins.push(`http://${iface.address}:3001`);
        }
      }
    }
  } catch {
    // Si no se pueden leer interfaces, seguir con los defaults
  }
  return origins;
};

// Version: 3.18.0 - Security hardening + quality improvements
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Permitir requests cross-origin en desarrollo (red local, IP dinámica)
  // Detecta automáticamente todas las interfaces de red IPv4 del servidor.
  allowedDevOrigins: getDevOrigins(),
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },
  // Fix: evitar que React se externalice en el server bundle
  // Sin esto, los componentes del servidor obtienen null al llamar useContext()
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externalPackages = ['react', 'react-dom', 'scheduler'];
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.filter(
          (e: string | RegExp | Function) => {
            if (typeof e === 'string') return !externalPackages.includes(e);
            if (e instanceof RegExp) return !externalPackages.some(p => e.test(p));
            return true;
          }
        );
      } else if (typeof config.externals === 'function') {
        const originalFn = config.externals;
        config.externals = (
          ...args: Parameters<typeof originalFn>
        ): ReturnType<typeof originalFn> => {
          const result = originalFn(...args);
          // Normalize to array and filter
          if (Array.isArray(result)) {
            return result.filter(
              (e: string | RegExp | Function) => {
                if (typeof e === 'string') return !externalPackages.includes(e);
                if (e instanceof RegExp) return !externalPackages.some(p => e.test(p));
                return true;
              }
            ) as any;
          }
          return result;
        };
      } else if (typeof config.externals === 'object' && config.externals !== null) {
        externalPackages.forEach(pkg => delete (config.externals as Record<string, string>)[pkg]);
      }
    }
    return config;
  },
};

export default nextConfig;
