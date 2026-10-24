/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // O telão da festa tem 768x512. O corte entra um pouco abaixo disso
        // para o layout de duas colunas valer mesmo que a janela do navegador
        // fique alguns pixels menor que a tela.
        telao: '700px',
      },
      colors: {
        // Destaque e fundo vêm de variáveis CSS (ver index.css) para o tema
        // (Arraiá / Oktoberfest) re-estilizar o app inteiro via data-theme.
        background: 'rgb(var(--color-background) / <alpha-value>)',
        sidebar: '#151619',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-light': 'rgb(var(--color-accent-light) / <alpha-value>)',
        'accent-dark': 'rgb(var(--color-accent-dark) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
}
