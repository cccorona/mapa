/**
 * En desarrollo: envía el mensaje al servidor para que se imprima en la terminal (npm run dev).
 * No bloquea; ignora errores de red.
 */
function devLog(msg: string, data?: unknown) {
  if (typeof window === "undefined") return
  if (process.env.NODE_ENV !== "development") return
  const payload = data !== undefined ? JSON.stringify({ msg, data }) : JSON.stringify({ msg })
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}

export { devLog }
