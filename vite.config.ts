import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
            manifest: {
                name: 'CURA.TOR',
                short_name: 'CURA.TOR',
                description: 'Smart Contact Curation - Scan business cards with OCR',
                theme_color: '#020617',
                background_color: '#0a0f1a',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/',
                icons: [
                    {
                        src: '/icons/icon-72.png',
                        sizes: '72x72',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-96.png',
                        sizes: '96x96',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-128.png',
                        sizes: '128x128',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-144.png',
                        sizes: '144x144',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-152.png',
                        sizes: '152x152',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: '/icons/icon-384.png',
                        sizes: '384x384',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ],
                categories: ['business', 'productivity', 'utilities']
            },
            workbox: {
                // Cache static assets
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

                // Runtime caching for Tesseract.js assets
                runtimeCaching: [
                    {
                        // Cache Tesseract worker files
                        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'tesseract-worker-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Tesseract language data
                        urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'tesseract-lang-cache',
                            expiration: {
                                maxEntries: 5,
                                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-stylesheets'
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
});
