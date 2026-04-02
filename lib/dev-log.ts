/**
 * En desarrollo: imprime en la consola del navegador. No hace POST al servidor.
 */
function devLog(msg: string, data?: unknown) {
  if (typeof window === "undefined") return
  if (process.env.NODE_ENV !== "development") return
  if (data !== undefined) {
    console.log(msg, data)
  } else {
    console.log(msg)
  }
}

export { devLog }
