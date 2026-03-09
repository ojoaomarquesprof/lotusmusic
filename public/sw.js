// Motor Service Worker da Lótus Music
// Isso habilita a instalação do PWA nos celulares e navegadores

self.addEventListener('install', (event) => {
  console.log('Lótus Music App: Motor instalado.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Lótus Music App: Motor ativado.');
});

self.addEventListener('fetch', (event) => {
  // Apenas deixa a internet fluir normalmente
  return;
});