// Temas da página inicial (antes do login). Cada tema troca a identidade visual
// (cores, emoji, título) e o conteúdo mostrado abaixo do formulário de login.
export type LoginThemeId = 'saojoao' | 'oktoberfest'

export interface LoginTheme {
  id: LoginThemeId
  switchLabel: string
  switchEmoji: string
  emoji: string
  titleTop: string
  titleBottom: string
  subtitle: string
  bg: string
  primary: string
  primaryDark: string
  titleColor: string
  titleClass: string
}

export const LOGIN_THEMES: Record<LoginThemeId, LoginTheme> = {
  saojoao: {
    id: 'saojoao',
    switchLabel: 'Arraiá',
    switchEmoji: '🌽',
    emoji: '🌽',
    titleTop: 'Arraiá do',
    titleBottom: 'Lar São Cristóvão',
    subtitle: 'Sistema de Gestão de Pedidos',
    bg: '#F5F5F0',
    primary: '#5A5A40',
    primaryDark: '#3A3A28',
    titleColor: '#3A3A28',
    titleClass: 'font-serif italic',
  },
  oktoberfest: {
    id: 'oktoberfest',
    switchLabel: 'Oktoberfest',
    switchEmoji: '🍺',
    emoji: '🍺',
    titleTop: 'Oktoberfest',
    titleBottom: 'Lar São Cristóvão',
    subtitle: 'Sistema de Gestão de Pedidos',
    bg: '#EEF3FA',
    primary: '#1565C0',
    primaryDark: '#0D47A1',
    titleColor: '#0D47A1',
    titleClass: 'font-serif font-bold',
  },
}

export const DEFAULT_LOGIN_THEME: LoginThemeId = 'saojoao'
