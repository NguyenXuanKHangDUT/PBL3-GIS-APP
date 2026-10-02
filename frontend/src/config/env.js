const getRequiredEnv = (key) => {
  const value = import.meta.env[key]

  if (!value) {
    throw new Error(`Missing required Vite environment variable: ${key}`)
  }

  return value
    .replace(/^__ORIGIN__/, window.location.origin)
    .replace(/\/+$/, '')
}

export const API_URL = getRequiredEnv('VITE_API_URL')
export const SOCKET_URL = getRequiredEnv('VITE_SOCKET_URL')
export const GEOSERVER_URL = getRequiredEnv('VITE_GEOSERVER_URL')
