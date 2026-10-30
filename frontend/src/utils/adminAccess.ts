export function adminPanelFor(role: string | undefined | null): boolean {
  return role === 'admin';
}
