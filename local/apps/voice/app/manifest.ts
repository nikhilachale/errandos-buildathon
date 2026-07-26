import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#10130f',
    description: 'A voice-first command surface for safe real-world errands.',
    display: 'standalone',
    name: 'JaldiAI',
    orientation: 'portrait',
    short_name: 'JaldiAI',
    start_url: '/',
    theme_color: '#10130f',
  };
}
