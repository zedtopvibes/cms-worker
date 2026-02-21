// src/routes/admin/layout.js

export async function adminLayout(title, content, auth, activePage = 'dashboard', pendingMigrations = 0, duplicateCounts = {}) {
  const username = auth?.session?.username || 'Admin';
  
  // Calculate total duplicates for the badge
  const totalDuplicates = (duplicateCounts?.total || 0) > 0 ? duplicateCounts.total : 0;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
    <title>${title} - Admin | ZEDALBUMS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --orange: #ff5500;
            --orange-light: #ff6a1a;
            --orange-dark: #e64c00;
            --dark: #1a1a1a;
            --gray: #666;
            --light-gray: #f0f2f5;
            --white: #ffffff;
            --shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        body {
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--light-gray);
            min-height: 100vh;
            line-height: 1.5;
            color: #333;
        }
        
        /* Mobile-First Container */
        .admin-container {
            width: 100%;
            max-width: 1400px;
            margin: 0 auto;
            padding: 10px;
        }
        
        /* Header - Mobile First */
        .admin-header {
            background: var(--white);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: var(--shadow);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .header-top h1 {
            color: var(--orange);
            font-size: 1.3rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .header-top h1 i {
            font-size: 1.3rem;
        }
        
        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--light-gray);
            padding: 8px 15px;
            border-radius: 30px;
            font-size: 0.9rem;
            flex-wrap: wrap;
        }
        
        .user-info i {
            color: var(--orange);
        }
        
        .user-info span {
            font-weight: 600;
            color: #333;
        }
        
        .logout-btn {
            color: #666;
            transition: color 0.3s;
            padding: 8px;
        }
        
        .logout-btn:hover {
            color: var(--orange);
        }
        
        /* Navigation Tabs - Mobile First (Horizontal Scroll on Mobile) */
        .admin-tabs {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            padding: 5px 0;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            white-space: nowrap;
        }
        
        .admin-tabs::-webkit-scrollbar {
            display: none;
        }
        
        .tab-btn {
            padding: 10px 15px;
            background: transparent;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            color: #666;
            cursor: pointer;
            transition: all 0.3s;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
            position: relative;
        }
        
        .tab-btn i {
            font-size: 1rem;
        }
        
        .tab-btn:hover {
            background: #f0f0f0;
            color: var(--orange);
        }
        
        .tab-btn.active {
            background: var(--orange);
            color: white;
        }
        
        /* Badge for notifications */
        .tab-badge {
            background: #ff5500;
            color: white;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 0.65rem;
            font-weight: 600;
            margin-left: 5px;
            min-width: 18px;
            text-align: center;
            line-height: 1.2;
        }
        
        .tab-btn.active .tab-badge {
            background: white;
            color: #ff5500;
        }
        
        /* Pulse animation for new notifications */
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .tab-badge.pulse {
            animation: pulse 1s ease-in-out;
        }
        
        /* Content Area */
        .admin-content {
            background: var(--white);
            border-radius: 12px;
            padding: 15px;
            box-shadow: var(--shadow);
            overflow-x: auto;
        }
        
        /* Stats Grid - Mobile First */
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: var(--light-gray);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #e8e8e8;
        }
        
        .stat-card h3 {
            font-size: 0.8rem;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .stat-card .number {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--orange);
            line-height: 1.2;
        }
        
        .stat-card .label {
            font-size: 0.75rem;
            color: #999;
            margin-top: 5px;
        }
        
        /* Tables - Mobile First */
        .table-responsive {
            overflow-x: auto;
            margin: 0 -15px;
            padding: 0 15px;
            -webkit-overflow-scrolling: touch;
        }
        
        .admin-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 600px;
        }
        
        .admin-table th {
            text-align: left;
            padding: 12px 8px;
            background: var(--light-gray);
            border-bottom: 2px solid #e0e0e0;
            font-size: 0.8rem;
            font-weight: 600;
            color: #666;
            white-space: nowrap;
        }
        
        .admin-table td {
            padding: 12px 8px;
            border-bottom: 1px solid #e8e8e8;
            font-size: 0.9rem;
        }
        
        .admin-table tr:hover {
            background: #f9f9f9;
        }
        
        /* Card View for Mobile */
        .mobile-cards {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .mobile-card {
            background: var(--light-gray);
            border-radius: 10px;
            padding: 15px;
            border: 1px solid #e8e8e8;
        }
        
        .mobile-card-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.9rem;
        }
        
        .mobile-card-label {
            color: #666;
            font-weight: 500;
        }
        
        .mobile-card-value {
            font-weight: 600;
            color: #333;
        }
        
        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            min-height: 44px;
        }
        
        .btn-primary {
            background: var(--orange);
            color: white;
        }
        
        .btn-primary:hover {
            background: var(--orange-light);
        }
        
        .btn-secondary {
            background: #f0f0f0;
            color: #333;
        }
        
        .btn-secondary:hover {
            background: #e0e0e0;
        }
        
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        
        .btn-success {
            background: #28a745;
            color: white;
        }
        
        .btn-info {
            background: #00b894;
            color: white;
        }
        
        .btn-sm {
            padding: 6px 12px;
            font-size: 0.8rem;
            min-height: 36px;
        }
        
        .btn-block {
            width: 100%;
        }
        
        /* Forms */
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #333;
            font-size: 0.9rem;
        }
        
        .form-control {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1rem;
            font-family: 'Montserrat', sans-serif;
            min-height: 44px;
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--orange);
        }
        
        select.form-control {
            height: 44px;
        }
        
        textarea.form-control {
            min-height: 100px;
            resize: vertical;
        }
        
        /* Alerts */
        .alert {
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 0.9rem;
        }
        
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .alert-danger {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .alert-info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        .alert-warning {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-state i {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 15px;
        }
        
        .empty-state h3 {
            font-size: 1.2rem;
            margin-bottom: 10px;
            color: #333;
        }
        
        /* Badges */
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
        }
        
        .badge-success {
            background: #28a745;
            color: white;
        }
        
        .badge-warning {
            background: #ffc107;
            color: #333;
        }
        
        .badge-danger {
            background: #dc3545;
            color: white;
        }
        
        .badge-info {
            background: #17a2b8;
            color: white;
        }
        
        /* Pagination */
        .pagination {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            justify-content: center;
            margin-top: 20px;
        }
        
        .pagination-item {
            padding: 8px 12px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            color: #333;
            text-decoration: none;
            font-size: 0.9rem;
            transition: all 0.3s;
        }
        
        .pagination-item:hover {
            background: #f0f0f0;
            border-color: var(--orange);
        }
        
        .pagination-item.active {
            background: var(--orange);
            color: white;
            border-color: var(--orange);
        }
        
        .pagination-item.disabled {
            opacity: 0.5;
            pointer-events: none;
        }
        
        .pagination-prev, .pagination-next {
            font-weight: 600;
        }
        
        .pagination-ellipsis {
            padding: 8px 12px;
            color: #999;
        }
        
        /* Desktop Styles */
        @media (min-width: 768px) {
            .admin-container {
                padding: 20px;
            }
            
            .admin-header {
                padding: 20px 25px;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
            }
            
            .header-top h1 {
                font-size: 1.5rem;
            }
            
            .stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
            }
            
            .stat-card {
                padding: 20px;
            }
            
            .stat-card .number {
                font-size: 2rem;
            }
            
            .mobile-cards {
                display: none;
            }
            
            .table-responsive {
                margin: 0;
                padding: 0;
            }
        }
        
        /* Small phones */
        @media (max-width: 480px) {
            .admin-header {
                padding: 12px;
            }
            
            .header-top h1 {
                font-size: 1.1rem;
            }
            
            .user-info {
                padding: 5px 10px;
                font-size: 0.8rem;
            }
            
            .btn {
                padding: 8px 12px;
                font-size: 0.8rem;
            }
            
            .stat-card .number {
                font-size: 1.5rem;
            }
            
            .tab-btn {
                padding: 8px 12px;
                font-size: 0.8rem;
            }
        }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="admin-header">
            <div class="header-top">
                <h1>
                    <i class="fas fa-cog"></i> 
                    ${title}
                </h1>
                <div class="user-info">
                    <i class="fas fa-user-circle"></i>
                    <span>${username}</span>
                    <a href="/admin/logout" class="logout-btn" title="Logout">
                        <i class="fas fa-sign-out-alt"></i>
                    </a>
                </div>
            </div>
            
            <div class="admin-tabs">
                <a href="/admin" class="tab-btn ${activePage === 'dashboard' ? 'active' : ''}">
                    <i class="fas fa-tachometer-alt"></i> Dashboard
                </a>
                <a href="/admin/upload" class="tab-btn ${activePage === 'upload' ? 'active' : ''}">
                    <i class="fas fa-cloud-upload-alt"></i> Upload
                </a>
                <a href="/admin/songs" class="tab-btn ${activePage === 'songs' ? 'active' : ''}">
                    <i class="fas fa-music"></i> Songs
                </a>
                <a href="/admin/albums" class="tab-btn ${activePage === 'albums' ? 'active' : ''}">
                    <i class="fas fa-compact-disc"></i> Albums
                </a>
                <a href="/admin/artists" class="tab-btn ${activePage === 'artists' ? 'active' : ''}">
                    <i class="fas fa-microphone"></i> Artists
                </a>
                <a href="/admin/playlists" class="tab-btn ${activePage === 'playlists' ? 'active' : ''}">
                    <i class="fas fa-list"></i> Playlists
                </a>
                <a href="/admin/stats" class="tab-btn ${activePage === 'stats' ? 'active' : ''}">
                    <i class="fas fa-chart-line"></i> Stats
                </a>
                <a href="/admin/activity" class="tab-btn ${activePage === 'activity' ? 'active' : ''}">
                    <i class="fas fa-history"></i> Activity
                </a>
                <a href="/admin/bulk" class="tab-btn ${activePage === 'bulk' ? 'active' : ''}">
                    <i class="fas fa-tasks"></i> Bulk Ops
                </a>
                <a href="/admin/migrate" class="tab-btn ${activePage === 'migrate' ? 'active' : ''}">
                    <i class="fas fa-database"></i> Migrations
                    ${pendingMigrations > 0 ? '<span class="tab-badge">!</span>' : ''}
                </a>
                <!-- TRASH TAB -->
                <a href="/admin/trash" class="tab-btn ${activePage === 'trash' ? 'active' : ''}">
                    <i class="fas fa-trash-alt"></i> Trash
                </a>
                <!-- DUPLICATE DETECTOR TAB WITH BADGE -->
                <a href="/admin/duplicate-detector" class="tab-btn ${activePage === 'duplicate-detector' ? 'active' : ''}">
                    <i class="fas fa-copy"></i> Duplicate Detector
                    ${totalDuplicates > 0 ? `<span class="tab-badge ${activePage !== 'duplicate-detector' ? 'pulse' : ''}">${totalDuplicates}</span>` : ''}
                </a>
                <!-- Announcement System -->
                <a href="/admin/announcements" class="tab-btn ${activePage === 'announcements' ? 'active' : ''}">
                    <i class="fas fa-bullhorn"></i> Announcements
                </a>
                <!-- Content Moderation -->
                <a href="/admin/moderation" class="tab-btn ${activePage === 'moderation' ? 'active' : ''}">
                    <i class="fas fa-shield-alt"></i> Moderation
                </a>
                <!-- User Management -->
                <a href="/admin/user-management" class="tab-btn ${activePage === 'user-management' ? 'active' : ''}">
                    <i class="fas fa-users-cog"></i> User Management
                </a>
                <!-- Scheduled Tasks -->
                <a href="/admin/scheduled-tasks" class="tab-btn ${activePage === 'scheduled-tasks' ? 'active' : ''}">
                    <i class="fas fa-clock"></i> Scheduled Tasks
                </a>
                <!-- AI-Powered Tagging -->
                <a href="/admin/ai-tagging" class="tab-btn ${activePage === 'ai-tagging' ? 'active' : ''}">
                    <i class="fas fa-robot"></i> AI Tagging
                </a>
                <!-- Ad Management -->
                <a href="/admin/ad-management" class="tab-btn ${activePage === 'ad-management' ? 'active' : ''}">
                    <i class="fas fa-ad"></i> Ad Management
                </a>
                <!-- System Settings -->
                <a href="/admin/system-settings" class="tab-btn ${activePage === 'system-settings' ? 'active' : ''}">
                    <i class="fas fa-cogs"></i> System Settings
                </a>
                <!-- Theme Customizer -->
                <a href="/admin/theme-customizer" class="tab-btn ${activePage === 'theme-customizer' ? 'active' : ''}">
                    <i class="fas fa-palette"></i> Theme Customizer
                </a>
            </div>
        </div>
        
        <div class="admin-content">
            ${content}
        </div>
    </div>

    <!-- Quick Preview Modal - Inline Script -->
    <script>
    // ==================== QUICK PREVIEW MODAL ====================
    (function() {
        class PreviewModal {
            constructor() {
                this.modal = null;
                this.init();
            }

            init() {
                this.modal = document.createElement('div');
                this.modal.id = 'previewModal';
                this.modal.style.cssText = \`
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
                \`;
                
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) this.close();
                });
                
                document.body.appendChild(this.modal);
                
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                        this.close();
                    }
                });
            }

            async show(type, id) {
                console.log('Preview clicked:', type, id);
                
                this.modal.innerHTML = this.getLoadingHTML();
                this.modal.style.display = 'flex';

                try {
                    const response = await fetch(\`/api/preview?type=\${type}&id=\${encodeURIComponent(id)}\`);
                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to load preview');
                    }

                    this.modal.innerHTML = this.getContentHTML(data);
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
                return \`
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
                \`;
            }

            getErrorHTML(message) {
                return \`
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
                        <p style="color: #666; margin-bottom: 25px;">\${message}</p>
                        <button onclick="window.previewModal.close()" class="btn btn-primary" style="padding: 12px 30px; background: #ff5500; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                \`;
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

                return \`
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
                        <div style="background: \${gradient}; padding: 30px 30px 40px; text-align: center; border-radius: 20px 20px 0 0; position: relative;">
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
                            ">
                                <i class="fas fa-times"></i>
                            </button>
                            
                            \${item.thumbnail ? \`
                                <img src="\${item.thumbnail}" alt="\${item.title || item.name}" style="
                                    width: 140px;
                                    height: 140px;
                                    border-radius: \${item.type === 'artist' ? '50%' : '16px'};
                                    object-fit: cover;
                                    border: 4px solid white;
                                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                                    margin-bottom: 15px;
                                ">
                            \` : \`
                                <div style="
                                    width: 140px;
                                    height: 140px;
                                    border-radius: \${item.type === 'artist' ? '50%' : '16px'};
                                    background: rgba(255,255,255,0.2);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    margin: 0 auto 15px;
                                    border: 4px solid white;
                                ">
                                    <i class="fas \${icon}" style="font-size: 4rem; color: white;"></i>
                                </div>
                            \`}
                            
                            <h2 style="color: white; margin: 0 0 5px; font-size: 1.8rem;">\${item.title || item.name}</h2>
                            <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 1.1rem;">
                                \${item.type === 'song' ? item.artist : 
                                  item.type === 'album' ? item.artist : 
                                  item.type === 'artist' ? item.genre : 
                                  \`by \${item.curator}\`}
                            </p>
                            
                            \${item.featured ? \`
                                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 0.9rem;">
                                    <i class="fas fa-users"></i> \${item.featured}
                                </p>
                            \` : ''}
                        </div>
                        
                        <div style="padding: 25px;">
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;">
                                \${item.type === 'song' ? \`
                                    <div class="stat-box">
                                        <i class="fas fa-clock" style="color: #ff5500;"></i>
                                        <div class="stat-value">\${item.duration}</div>
                                        <div class="stat-label">Duration</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-play" style="color: #ff5500;"></i>
                                        <div class="stat-value">\${item.plays}</div>
                                        <div class="stat-label">Plays</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-eye" style="color: #4a90e2;"></i>
                                        <div class="stat-value">\${item.views}</div>
                                        <div class="stat-label">Views</div>
                                    </div>
                                \` : item.type === 'album' ? \`
                                    <div class="stat-box">
                                        <i class="fas fa-music" style="color: #28a745;"></i>
                                        <div class="stat-value">\${item.songCount}</div>
                                        <div class="stat-label">Songs</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-eye" style="color: #4a90e2;"></i>
                                        <div class="stat-value">\${item.views}</div>
                                        <div class="stat-label">Views</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-calendar" style="color: #28a745;"></i>
                                        <div class="stat-value">\${item.created}</div>
                                        <div class="stat-label">Released</div>
                                    </div>
                                \` : item.type === 'artist' ? \`
                                    <div class="stat-box">
                                        <i class="fas fa-music" style="color: #9b59b6;"></i>
                                        <div class="stat-value">\${item.songCount}</div>
                                        <div class="stat-label">Songs</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-compact-disc" style="color: #9b59b6;"></i>
                                        <div class="stat-value">\${item.albumCount}</div>
                                        <div class="stat-label">Albums</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-eye" style="color: #4a90e2;"></i>
                                        <div class="stat-value">\${item.views}</div>
                                        <div class="stat-label">Views</div>
                                    </div>
                                \` : \`
                                    <div class="stat-box">
                                        <i class="fas fa-music" style="color: #4a90e2;"></i>
                                        <div class="stat-value">\${item.songCount}</div>
                                        <div class="stat-label">Songs</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-eye" style="color: #4a90e2;"></i>
                                        <div class="stat-value">\${item.views}</div>
                                        <div class="stat-label">Views</div>
                                    </div>
                                    <div class="stat-box">
                                        <i class="fas fa-calendar" style="color: #4a90e2;"></i>
                                        <div class="stat-value">\${item.created}</div>
                                        <div class="stat-label">Created</div>
                                    </div>
                                \`}
                            </div>
                            
                            <div style="margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 12px;">
                                <h4 style="margin: 0 0 8px; font-size: 1rem; color: #333;">
                                    <i class="fas fa-align-left" style="color: #ff5500;"></i> Description
                                </h4>
                                <p style="color: #666; line-height: 1.6; margin: 0; font-size: 0.95rem;">
                                    \${item.description}
                                </p>
                            </div>
                            
                            <div style="display: flex; gap: 12px;">
                                <a href="\${item.url}" target="_blank" class="btn btn-primary" style="
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
                                ">
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
                                ">
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
                        }
                        @media (max-width: 480px) {
                            .stat-box {
                                padding: 8px 4px;
                            }
                            .stat-value {
                                font-size: 1rem;
                            }
                        }
                    </style>
                \`;
            }
        }

        // Initialize and attach to window
        window.previewModal = new PreviewModal();
        console.log('✅ Preview modal initialized');
    })();
    </script>
</body>
</html>
  `;
}