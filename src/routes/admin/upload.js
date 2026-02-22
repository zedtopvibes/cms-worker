// ===== UPLOAD SUCCESS SECTION (around line 400-450) =====
if (path === '/upload') {
    if (req.method === 'GET') {
      const content = await handleAdminUpload(req, env, ctx, auth);
      return new Response(adminLayout('Upload Song', content, auth, 'upload', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminUploadPost(req, env, ctx, auth);
      if (!result.success) {
        const content = `
          <div class="alert alert-danger" style="margin-bottom: 20px;">
              <i class="fas fa-exclamation-circle"></i>
              Error: ${result.error}
          </div>
          <a href="/admin/upload" class="btn btn-primary">
              <i class="fas fa-arrow-left"></i> Try Again
          </a>
        `;
        return new Response(adminLayout('Upload Failed', content, auth, 'upload', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      // SUCCESS PAGE - UPDATED WITH SLUGS
      const content = `
        <div style="text-align: center; padding: 20px 10px;">
            <div style="background: #d4edda; color: #155724; padding: 25px 20px; border-radius: 12px; margin-bottom: 30px;">
                <i class="fas fa-check-circle" style="font-size: 4rem; margin-bottom: 15px; color: #28a745;"></i>
                <h2 style="margin-bottom: 10px; font-size: 1.5rem;">Upload Successful!</h2>
                <p style="font-size: 1.2rem; margin-bottom: 5px; font-weight: 600;">${result.title}</p>
                <p style="color: #666; margin-bottom: 15px;">by ${result.artistName}</p>
                <div style="background: white; padding: 12px; border-radius: 8px; display: inline-block;">
                    <i class="fas fa-clock" style="color: #ff5500;"></i>
                    <strong>Duration:</strong> ${formatDuration(result.duration)}
                </div>
                <div style="margin-top: 15px; background: #f8f9fa; padding: 10px; border-radius: 8px;">
                    <i class="fas fa-link" style="color: #ff5500;"></i>
                    <span style="font-family: monospace; background: white; padding: 4px 8px; border-radius: 4px;">/song/${result.slug}</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto;">
                <!-- View Song - Now using slug -->
                <a href="/song/${result.slug}" class="btn btn-primary" target="_blank" style="padding: 16px;">
                    <i class="fas fa-play"></i> View Song
                </a>
                
                <!-- Upload Another -->
                <a href="/admin/upload" class="btn btn-secondary" style="padding: 16px;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Another Song
                </a>
                
                <!-- Album Link - If album exists, need to get album slug -->
                ${result.albumId ? `
                    <a href="/album/${result.albumId}" class="btn btn-secondary" target="_blank" style="padding: 16px;">
                        <i class="fas fa-compact-disc"></i> View Album
                    </a>
                ` : ''}
                
                <!-- Playlist Link - If playlist exists, need to get playlist slug -->
                ${result.playlistId ? `
                    <a href="/playlist/${result.playlistId}" class="btn btn-secondary" target="_blank" style="padding: 16px;">
                        <i class="fas fa-list"></i> View Playlist
                    </a>
                ` : ''}
                
                <!-- Back to Dashboard -->
                <a href="/admin/dashboard" class="btn btn-secondary" style="padding: 16px; background: #f0f0f0;">
                    <i class="fas fa-tachometer-alt"></i> Back to Dashboard
                </a>
            </div>
        </div>
      `;
      
      return new Response(adminLayout('Upload Successful', content, auth, 'upload', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }