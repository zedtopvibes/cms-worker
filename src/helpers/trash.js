// src/helpers/trash.js

// =============================
// GET TRASH ITEMS
// =============================
export async function getTrashItems(env, type = 'all') {
  const query = type === 'all'
    ? `SELECT * FROM trash_items WHERE is_deleted = 0 ORDER BY deleted_at DESC`
    : `SELECT * FROM trash_items WHERE is_deleted = 0 AND item_type = ? ORDER BY deleted_at DESC`;

  const { results } = type === 'all'
    ? await env.DB.prepare(query).all()
    : await env.DB.prepare(query).bind(type).all();

  return results || [];
}

// =============================
// GET TRASH STATS
// =============================
export async function getTrashStats(env) {
  const { results } = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_items,
      COALESCE(SUM(file_size),0) as total_size
    FROM trash_items
    WHERE is_deleted = 0
  `).all();

  return results?.[0] || { total_items: 0, total_size: 0 };
}

// =============================
// GET TRASH SETTINGS
// =============================
export async function getTrashSettings(env) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM trash_settings LIMIT 1
  `).all();

  return results?.[0] || { retention_days: 30 };
}

// =============================
// UPDATE TRASH SETTINGS
// =============================
export async function updateTrashSettings(env, adminId, settings) {
  await env.DB.prepare(`
    UPDATE trash_settings
    SET retention_days = ?
  `).bind(settings.retention_days).run();

  return { success: true };
}

// =============================
// RESTORE ITEM
// =============================
export async function restoreFromTrash(env, adminId, trashId) {
  const item = await env.DB.prepare(`
    SELECT * FROM trash_items WHERE id = ? AND is_deleted = 0
  `).bind(trashId).first();

  if (!item) {
    return { success: false, message: 'Item not found in trash' };
  }

  const trashPaths = JSON.parse(item.trash_paths || '[]');

  for (const trashPath of trashPaths) {
    const file = await env.media.get(trashPath);
    if (!file) continue;

    const originalPath = trashPath.replace(/^trash\//, '');

    await env.media.put(originalPath, await file.arrayBuffer(), {
      httpMetadata: file.httpMetadata,
      customMetadata: file.customMetadata
    });

    await env.media.delete(trashPath);
  }

  await env.DB.prepare(`
    UPDATE trash_items
    SET is_deleted = 1,
        restored_at = datetime('now')
    WHERE id = ?
  `).bind(trashId).run();

  return { success: true };
}

// =============================
// DELETE PERMANENTLY
// =============================
export async function deletePermanently(env, trashId) {
  const item = await env.DB.prepare(`
    SELECT * FROM trash_items WHERE id = ?
  `).bind(trashId).first();

  if (!item) {
    return { success: false, message: 'Item not found' };
  }

  const trashPaths = JSON.parse(item.trash_paths || '[]');

  for (const trashPath of trashPaths) {
    await env.media.delete(trashPath);
  }

  await env.DB.prepare(`
    UPDATE trash_items
    SET is_deleted = 1,
        permanently_deleted_at = datetime('now')
    WHERE id = ?
  `).bind(trashId).run();

  return { success: true };
}

// =============================
// EMPTY TRASH
// =============================
export async function emptyTrash(env, type = 'all') {
  const items = await getTrashItems(env, type);

  for (const item of items) {
    const trashPaths = JSON.parse(item.trash_paths || '[]');

    for (const trashPath of trashPaths) {
      await env.media.delete(trashPath);
    }

    await env.DB.prepare(`
      UPDATE trash_items
      SET is_deleted = 1,
          permanently_deleted_at = datetime('now')
      WHERE id = ?
    `).bind(item.id).run();
  }

  return { success: true };
}

// =============================
// CLEANUP EXPIRED TRASH (CRON)
// =============================
export async function cleanupExpiredTrash(env) {
  const settings = await getTrashSettings(env);
  const days = settings.retention_days || 30;

  const { results } = await env.DB.prepare(`
    SELECT * FROM trash_items
    WHERE is_deleted = 0
    AND deleted_at <= datetime('now', '-' || ? || ' days')
  `).bind(days).all();

  for (const item of results || []) {
    const trashPaths = JSON.parse(item.trash_paths || '[]');

    for (const trashPath of trashPaths) {
      await env.media.delete(trashPath);
    }

    await env.DB.prepare(`
      UPDATE trash_items
      SET is_deleted = 1,
          permanently_deleted_at = datetime('now')
      WHERE id = ?
    `).bind(item.id).run();
  }

  return { success: true };
}