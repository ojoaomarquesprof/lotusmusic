import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lótus Music - Portal do Aluno',
    short_name: 'Lótus Music',
    description: 'Portal de acesso e gestão para alunos da escola de música.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        // CORREÇÃO AQUI: 'any maskable' deve ser apenas 'maskable' ou 'any' 
        // para o TypeScript reconhecer o tipo correto da MetadataRoute.
        purpose: 'maskable', 
      },
    ],
  }
}