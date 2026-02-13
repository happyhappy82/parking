/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#374151',
            lineHeight: '1.8',
            h1: {
              fontWeight: '900',
              fontSize: '1.875rem',
              marginTop: '2.5rem',
              marginBottom: '1rem',
              color: '#111827',
            },
            h2: {
              fontWeight: '800',
              fontSize: '1.5rem',
              marginTop: '2rem',
              marginBottom: '0.75rem',
              color: '#111827',
              borderBottom: '2px solid #d1fae5',
              paddingBottom: '0.5rem',
            },
            h3: {
              fontWeight: '700',
              fontSize: '1.25rem',
              marginTop: '1.75rem',
              marginBottom: '0.5rem',
              color: '#1f2937',
            },
            a: {
              color: '#059669',
              fontWeight: '500',
              textDecoration: 'underline',
              textDecorationColor: '#a7f3d0',
              textUnderlineOffset: '3px',
              '&:hover': {
                color: '#047857',
                textDecorationColor: '#059669',
              },
            },
            blockquote: {
              borderLeftColor: '#10b981',
              backgroundColor: '#f0fdf4',
              borderRadius: '0.5rem',
              padding: '1rem 1.25rem',
              fontStyle: 'normal',
              color: '#374151',
            },
            code: {
              backgroundColor: '#f3f4f6',
              padding: '0.15rem 0.4rem',
              borderRadius: '0.25rem',
              fontSize: '0.875em',
              fontWeight: '500',
              color: '#1f2937',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            pre: {
              backgroundColor: '#1f2937',
              borderRadius: '0.75rem',
              padding: '1.25rem',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            },
            thead: {
              borderBottomWidth: '2px',
              borderBottomColor: '#d1d5db',
            },
            'thead th': {
              padding: '0.75rem 1rem',
              fontWeight: '600',
              color: '#111827',
              backgroundColor: '#f9fafb',
            },
            'tbody td': {
              padding: '0.75rem 1rem',
              borderBottomWidth: '1px',
              borderBottomColor: '#e5e7eb',
            },
            'tbody tr:last-child td': {
              borderBottomWidth: '0',
            },
            hr: {
              borderColor: '#e5e7eb',
              marginTop: '2rem',
              marginBottom: '2rem',
            },
            img: {
              borderRadius: '0.75rem',
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
            },
            strong: {
              color: '#111827',
              fontWeight: '700',
            },
            ul: {
              paddingLeft: '1.5rem',
            },
            ol: {
              paddingLeft: '1.5rem',
            },
            li: {
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
