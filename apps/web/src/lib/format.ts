export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR');
}
