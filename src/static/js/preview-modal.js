// ==================== QUICK PREVIEW MODAL ====================

class PreviewModal {
  constructor() {
    this.modal = null;
    this.init();
  }

  init() {
    // Create modal element
    this.modal = document.createElement('div');
    this.modal.id = 'previewModal';
    this.modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(5px);
    `;
    
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    
    document.body.appendChild(this.modal);
    
    // Add escape key listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display === 'flex') {
        this.close();
      }
    });
  }

  async show(type, id) {
    console.log('Preview clicked:', type, id); // Debug log
    
    // Show loading state
    this.modal.innerHTML = this.getLoadingHTML();
    this.modal.style.display = 'flex';

    try {
      // Fetch preview data
      const response = await fetch(`/api/preview?type=${type}&id=${encodeURIComponent(id)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load preview');
      }

      console.log('Preview data:', data); // Debug log

      // Render content based on type
      this.modal.innerHTML = this.getContentHTML(data);
      
      // Add animation class
      const content = this.modal.querySelector('.preview-content');
      setTimeout(() => content.classList.add('show'), 10);

    } catch (error) {
      console.error('Preview error:', error);
      this.modal.innerHTML = this.getErrorHTML(error.message);
    }
  }

  close() {
    const content = this.modal.querySelector('.preview-content');
    if (content) {
      content.classList.remove('show');
      setTimeout(() => {
        this.modal.style.display = 'none';
      }, 200);
    } else {
      this.modal.style.display = 'none';
    }
  }

  getLoadingHTML() {
    return `
      <div class="preview-content loading" style="
        background: white;
        border-radius: 16px;
        padding: 40px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        transform: scale(0.9);
        opacity: 0;
        transition: all 0.2s;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <div style="margin-bottom: 20px;">
          <div style="width: 80px; height: 80px; margin: 0 auto; border: 4px solid #f0f0f0; border-top-color: #ff5500; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <p style="color: #666; font-size: 1.1rem;">Loading preview...</p>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </div>
    `;
  }

  getErrorHTML(message) {
    return `
      <div class="preview-content" style="
        background: white;
        border-radius: 16px;
        padding: 40px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        transform: scale(0.9);
        opacity: 0;
        transition: all 0.2s;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <i class="fas fa-exclamation-circle" style="font-size: 4rem; color: #dc3545; margin-bottom: 20px;"></i>
        <h3 style="margin-bottom: 10px; color: #333;">Oops!</h3>
        <p style="color: #666; margin-bottom: 25px;">${message}</p>
        <button onclick="window.previewModal.close()" class="btn btn-primary" style="padding: 12px 30px;">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
    `;
  }

  getContentHTML(item) {
    const gradients = {
      song: 'linear-gradient(135deg, #ff5500, #ff8c00)',
      album: 'linear-gradient(135deg, #28a745, #20c997)',
      artist: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
      playlist: 'linear-gradient(135deg, #4a90e2, #9013fe)'
    };
    
    const icons = {
      song: 'fa-music',
      album: 'fa-compact-disc',
      artist: 'fa-microphone',
      playlist: 'fa-list'
    };

    const gradient = gradients[item.type] || gradients.song;
    const icon = icons[item.type] || 'fa-music';

    return `
      <div class="preview-content" style="
        background: white;
        border-radius: 20px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        box-shadow: 0 30px 60px rgba(0,0,0,0.3);
      ">
        <!-- Header with thumbnail -->
        <div style="
          background: ${gradient};
          padding: 30px 30px 40px;
          text-align: center;
          border-radius: 20px 20px 0 0;
          position: relative;
        ">
          <button onclick="window.previewModal.close()" style="
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            backdrop-filter: blur(5px);
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            <i class="fas fa-times"></i>
          </button>
          
          ${item.thumbnail ? `
            <img src="${item.thumbnail}" alt="${item.title || item.name}" style="
              width: 140px;
              height: 140px;
              border-radius: ${item.type === 'artist' ? '50%' : '16px'};
              object-fit: cover;
              border: 4px solid white;
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
              margin-bottom: 15px;
            ">
          ` : `
            <div style="
              width: 140px;
              height: 140px;
              border-radius: ${item.type === 'artist' ? '50%' : '16px'};
              background: rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 15px;
              border: 4px solid white;
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            ">
              <i class="fas ${icon}" style="font-size: 4rem; color: white;"></i>
            </div>
          `}
          
          <h2 style="color: white; margin: 0 0 5px; font-size: 1.8rem; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${item.title || item.name}
          </h2>
          
          <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 1.1rem;">
            ${item.type === 'song' ? item.artist : 
              item.type === 'album' ? item.artist : 
              item.type === 'artist' ? item.genre : 
              `by ${item.curator}`}
          </p>
          
          ${item.featured ? `
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 0.9rem;">
              <i class="fas fa-users"></i> ${item.featured}
            </p>
          ` : ''}
        </div>
        
        <!-- Content -->
        <div style="padding: 25px;">
          <!-- Stats Grid -->
          <div style="
            display: grid;
            grid-template-columns: repeat(${item.type === 'song' ? 3 : 3}, 1fr);
            gap: 12px;
            margin-bottom: 25px;
          ">
            ${item.type === 'song' ? `
              <div class="stat-box">
                <i class="fas fa-clock" style="color: #ff5500;"></i>
                <div class="stat-value">${item.duration}</div>
                <div class="stat-label">Duration</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-play" style="color: #ff5500;"></i>
                <div class="stat-value">${item.plays}</div>
                <div class="stat-label">Plays</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-eye" style="color: #4a90e2;"></i>
                <div class="stat-value">${item.views}</div>
                <div class="stat-label">Views</div>
              </div>
            ` : item.type === 'album' ? `
              <div class="stat-box">
                <i class="fas fa-music" style="color: #28a745;"></i>
                <div class="stat-value">${item.songCount}</div>
                <div class="stat-label">Songs</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-eye" style="color: #4a90e2;"></i>
                <div class="stat-value">${item.views}</div>
                <div class="stat-label">Views</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-calendar" style="color: #28a745;"></i>
                <div class="stat-value">${item.created}</div>
                <div class="stat-label">Released</div>
              </div>
            ` : item.type === 'artist' ? `
              <div class="stat-box">
                <i class="fas fa-music" style="color: #9b59b6;"></i>
                <div class="stat-value">${item.songCount}</div>
                <div class="stat-label">Songs</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-compact-disc" style="color: #9b59b6;"></i>
                <div class="stat-value">${item.albumCount}</div>
                <div class="stat-label">Albums</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-eye" style="color: #4a90e2;"></i>
                <div class="stat-value">${item.views}</div>
                <div class="stat-label">Views</div>
              </div>
            ` : `
              <div class="stat-box">
                <i class="fas fa-music" style="color: #4a90e2;"></i>
                <div class="stat-value">${item.songCount}</div>
                <div class="stat-label">Songs</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-eye" style="color: #4a90e2;"></i>
                <div class="stat-value">${item.views}</div>
                <div class="stat-label">Views</div>
              </div>
              <div class="stat-box">
                <i class="fas fa-calendar" style="color: #4a90e2;"></i>
                <div class="stat-value">${item.created}</div>
                <div class="stat-label">Created</div>
              </div>
            `}
          </div>
          
          <!-- Description -->
          <div style="margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 12px;">
            <h4 style="margin: 0 0 8px; font-size: 1rem; color: #333;">
              <i class="fas fa-align-left" style="color: #ff5500;"></i> Description
            </h4>
            <p style="color: #666; line-height: 1.6; margin: 0; font-size: 0.95rem;">
              ${item.description}
            </p>
          </div>
          
          <!-- Additional Info for Albums/Artists -->
          ${item.type === 'album' && item.allArtists ? `
            <div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px;">
              <i class="fas fa-users" style="color: #28a745;"></i>
              <strong style="margin-left: 5px;">Artists:</strong> ${item.allArtists}
            </div>
          ` : ''}
          
          ${item.type === 'artist' && item.origin ? `
            <div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px;">
              <i class="fas fa-map-marker-alt" style="color: #9b59b6;"></i>
              <strong style="margin-left: 5px;">Origin:</strong> ${item.origin}
            </div>
          ` : ''}
          
          <!-- Actions -->
          <div style="display: flex; gap: 12px;">
            <a href="${item.url}" target="_blank" class="btn btn-primary" style="
              flex: 2;
              text-decoration: none;
              padding: 14px;
              background: #ff5500;
              color: white;
              border: none;
              border-radius: 10px;
              font-weight: 600;
              font-size: 1rem;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              transition: all 0.2s;
            " onmouseover="this.style.background='#ff6a1a'" onmouseout="this.style.background='#ff5500'">
              <i class="fas fa-external-link-alt"></i> View Full Page
            </a>
            <button onclick="window.previewModal.close()" class="btn btn-secondary" style="
              flex: 1;
              padding: 14px;
              background: #f0f0f0;
              color: #333;
              border: none;
              border-radius: 10px;
              font-weight: 600;
              font-size: 1rem;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">
              <i class="fas fa-times"></i> Close
            </button>
          </div>
        </div>
      </div>
      
      <style>
        .preview-content.show {
          transform: scale(1) !important;
          opacity: 1 !important;
        }
        .stat-box {
          background: #f8f9fa;
          padding: 12px 8px;
          border-radius: 12px;
          text-align: center;
          transition: transform 0.2s;
        }
        .stat-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .stat-box i {
          font-size: 1.3rem;
          margin-bottom: 5px;
        }
        .stat-value {
          font-weight: 700;
          font-size: 1.2rem;
          color: #333;
        }
        .stat-label {
          font-size: 0.7rem;
          color: #999;
          text-transform: uppercase;
          margin-top: 3px;
          letter-spacing: 0.5px;
        }
        @media (max-width: 480px) {
          .preview-content {
            margin: 10px;
          }
          .stat-box {
            padding: 8px 4px;
          }
          .stat-value {
            font-size: 1rem;
          }
        }
      </style>
    `;
  }
}

// Initialize and attach to window
const previewModal = new PreviewModal();
window.previewModal = previewModal;  // Make it globally available

console.log('Preview modal initialized and attached to window');