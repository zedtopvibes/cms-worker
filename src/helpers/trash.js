// ===== API HANDLERS =====

export async function handleTrashRestore(req, env, ctx, auth) {
  try {
    const { id } = await req.json();
    console.log('🔄 Restore request for:', id);
    console.log('👤 Auth session:', auth?.session);
    
    // FIX: Provide a default value if auth.session.id is undefined
    const adminId = auth?.session?.id || 'system';
    console.log('👤 Using adminId:', adminId);
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        message: '❌ Missing trash item ID'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await restoreFromTrash(env, adminId, id);
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Item restored successfully' : '❌ Failed to restore item'),
      error: result.error
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Restore handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleTrashDelete(req, env, ctx, auth) {
  try {
    const { id } = await req.json();
    console.log('🗑️ Delete request for:', id);
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        message: '❌ Missing trash item ID'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await deletePermanently(env, id);
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Item permanently deleted' : '❌ Failed to delete'),
      error: result.error
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Delete handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleTrashEmpty(req, env, ctx, auth) {
  try {
    const { type } = await req.json();
    console.log('🧹 Empty trash request for type:', type);
    
    const result = await emptyTrash(env, type || 'all');
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Trash emptied successfully' : '❌ Failed to empty trash'),
      count: result.count
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Empty trash error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleTrashSettings(req, env, ctx, auth) {
  try {
    const settings = await req.json();
    console.log('⚙️ Update settings request:', settings);
    
    // FIX: Provide a default value if auth.session.id is undefined
    const adminId = auth?.session?.id || 'system';
    
    const result = await updateTrashSettings(env, adminId, settings);
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Settings saved' : '❌ Failed to save settings')
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Settings error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}