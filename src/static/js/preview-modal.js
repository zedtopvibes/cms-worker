// ==================== SIMPLE  PREVIEW MODAL TEST ====================

console.log('✅ Preview modal script loaded');

// Simple test function
window.testPreview = function() {
    alert('Preview button clicked!');
    console.log('Test preview function called');
};

// Create a simple modal
const testModal = document.createElement('div');
testModal.id = 'testModal';
testModal.style.cssText = `
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
`;
document.body.appendChild(testModal);

window.openTestModal = function() {
    console.log('Opening test modal');
    testModal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px;">
            <h2 style="color: #ff5500; margin-bottom: 15px;">Test Modal</h2>
            <p style="margin-bottom: 20px;">If you can see this, JavaScript is working!</p>
            <button onclick="closeTestModal()" style="background: #ff5500; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Close</button>
        </div>
    `;
    testModal.style.display = 'flex';
};

window.closeTestModal = function() {
    testModal.style.display = 'none';
};

// Also attach to previewModal for compatibility
window.previewModal = {
    show: function(type, id) {
        console.log('Preview clicked:', type, id);
        alert(`Preview clicked for ${type}: ${id}`);
        openTestModal();
    }
};

console.log('✅ Test modal ready');