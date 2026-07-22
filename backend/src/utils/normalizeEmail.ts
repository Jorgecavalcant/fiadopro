/**
 * Normaliza um e-mail para comparacao/persistencia consistente.
 *
 * Remove espacos nas pontas e converte para minusculas, garantindo que
 * "Jorge@Gmail.com" e "jorge@gmail.com" sejam tratados como o mesmo e-mail
 * em todas as rotas de autenticacao (register, login, google, forgot/reset
 * password) e evitando contas duplicadas no banco.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
