// ==================== SHARED ADMIN LAYOUT ====================

export function adminLayout(title, content, auth, activePage = 'dashboard', pendingMigrations = 0) {
  const username = auth?.session?.username || 'Admin';
  
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
            background: var(--orange);
            color: white;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 600;
            margin-left: 5px;
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
            </div>
        </div>
        
        <div class="admin-content">
            ${content}
        </div>
    </div>
<!-- Quick Preview Modal Script -->
<script src="/static/js/preview-modal.js"></script>

<!-- Initialize preview modal -->
<script>
    // Make sure previewModal is available globally
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Preview modal initialized');
    });

<!-- Test preview button -->

    setTimeout(function() {
        console.log('Preview modal available:', !!window.previewModal);
        if (window.previewModal) {
            console.log('Preview modal methods:', Object.keys(window.previewModal));
        }
    }, 1000);
</script>
</body>
</html>
  `;
}