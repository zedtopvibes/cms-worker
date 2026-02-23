function renderArtistList(type) {
    const searchTerm = document.getElementById(type + 'Search').value.toLowerCase();
    const listContainer = document.getElementById(type + 'ArtistList');
    
    const filtered = artistsData.filter(a => a.name.toLowerCase().includes(searchTerm));
    
    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No artists found</div>';
        return;
    }
    
    const selectedId = type === 'primary' ? document.getElementById('primaryArtistInput').value : null;
    
    let html = '';
    filtered.forEach(artist => {
        const isSelected = type === 'primary' ? artist.id === selectedId : featuredArtists.includes(artist.id);
        html += '<div class="artist-item ' + (isSelected ? 'selected' : '') + '" onclick="selectArtist(\'' + type + '\', \'' + artist.id + '\', \'' + artist.name.replace(/'/g, "\\'") + '\')">';
        html += '<span class="artist-name">' + artist.name + '</span>';
        html += '<span class="artist-song-count">' + artist.songCount + ' songs</span>';
        html += '</div>';
    });
    
    listContainer.innerHTML = html;
}