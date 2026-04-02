import { base44 } from '@/api/base44Client';

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
    }).catch(() => { });
  }).catch(() => { });
}