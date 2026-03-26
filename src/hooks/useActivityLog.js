import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});import { base44 } from '@/api/base44Client';

export function logActivity(action, entityType, entityId, entityName, details = '') {
  base44.auth.me().then(user => {
    base44.entities.ActivityLog.create({
      user_email: user?.email || 'unknown',
      user_name: user?.full_name || 'Unknown User',
      action,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      entity_name: entityName || '',
      details,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  }).catch(() => {});
}