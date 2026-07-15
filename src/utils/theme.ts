import { DEFAULT_LOGIN_THEME, type LoginThemeId } from '../data/loginThemes'

// Chave única do tema escolhido na tela inicial. O mesmo tema vale para o
// sistema interno (aplicado como data-theme no <html>, que troca as variáveis
// de cor em index.css).
export const THEME_KEY = 'login-theme'

export function getStoredTheme(): LoginThemeId {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'oktoberfest' || saved === 'saojoao' ? saved : DEFAULT_LOGIN_THEME
}

export function applyTheme(id: LoginThemeId) {
  document.documentElement.setAttribute('data-theme', id)
}

export function setStoredTheme(id: LoginThemeId) {
  localStorage.setItem(THEME_KEY, id)
  applyTheme(id)
}

// Emoji de marca por tema (barra lateral, telas de erro etc.)
export function themeEmoji(id: LoginThemeId): string {
  return id === 'oktoberfest' ? '🍺' : '🌽'
}
