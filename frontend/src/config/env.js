const normalizeUrl = (url) => {
  return url?.replace(/\/+$/, '')
}

export const API_URL = normalizeUrl(import.meta.env.VITE_API_URL)
export const SOCKET_URL = normalizeUrl(import.meta.env.VITE_SOCKET_URL)
export const GEOSERVER_URL = normalizeUrl(import.meta.env.VITE_GEOSERVER_URL)