// JavaScript tambahan: HTML tetap berisi seluruh judul lagu.
document.addEventListener('DOMContentLoaded', function () {
    const cards = [...document.querySelectorAll('.artist-card')];
    const grid = document.querySelector('.artist-grid');
    const header = document.querySelector('.site-header');

    // Pencarian dan filter genre.
    const filters = document.createElement('div');
    filters.className = 'tool-row';
    filters.innerHTML = `
        <label class="search-wrap">
            <input id="searchInput" type="search"
                   placeholder="Cari artis, album, atau lagu..." aria-label="Cari musik">
        </label>
        <label class="genre-wrap">
            <select id="genreFilter" aria-label="Filter genre">
                <option value="all">Semua genre</option>
                <option value="indie">Indie</option>
                <option value="pop">Pop</option>
                <option value="rock">Rock</option>
            </select>
        </label>`;
    grid.before(filters);

    const result = document.createElement('div');
    result.className = 'results-row';
    result.innerHTML = '<p id="artistCount"></p><p class="help-note">Klik album untuk melihat lagunya ↓</p>';
    grid.before(result);

    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = 'Musik tidak ditemukan. Coba kata kunci lain.';
    empty.hidden = true;
    grid.after(empty);

    const search = document.getElementById('searchInput');
    const genre = document.getElementById('genreFilter');
    const count = document.getElementById('artistCount');

    function filterMusic() {
        const keyword = search.value.trim().toLocaleLowerCase('id');
        const category = genre.value;
        let visible = 0;

        cards.forEach(function (card) {
            const matchText = card.textContent.toLocaleLowerCase('id').includes(keyword);
            const matchGenre = category === 'all' || card.dataset.genre === category;
            card.hidden = !(matchText && matchGenre);
            if (!card.hidden) visible++;
        });

        count.textContent = visible + ' dari ' + cards.length + ' artis';
        empty.hidden = visible !== 0;
    }
    search.addEventListener('input', filterMusic);
    genre.addEventListener('change', filterMusic);
    filterMusic();

    // Tombol favorit dan tautan pencarian lagu ke YouTube.
    cards.forEach(function (card) {
        const artist = card.dataset.name;
        const heart = document.createElement('button');
        heart.type = 'button';
        heart.className = 'favorite-btn';
        heart.setAttribute('aria-label', 'Favorit ' + artist);

        let saved = false;
        try { saved = localStorage.getItem('favorit:' + artist) === 'yes'; }
        catch (error) { /* Penyimpanan bisa diblokir browser. */ }

        function showHeart() {
            heart.textContent = saved ? '♥' : '♡';
            heart.setAttribute('aria-pressed', String(saved));
        }
        showHeart();
        card.querySelector('.artist-top').appendChild(heart);

        heart.addEventListener('click', function () {
            saved = !saved;
            try { localStorage.setItem('favorit:' + artist, saved ? 'yes' : 'no'); }
            catch (error) { /* Favorit tetap berfungsi selama halaman terbuka. */ }
            showHeart();
        });

        card.querySelectorAll('.tracklist li').forEach(function (song) {
            const title = song.textContent.trim();
            const link = document.createElement('a');
            link.textContent = title;
            link.href = 'https://www.youtube.com/results?search_query='
                + encodeURIComponent(artist + ' ' + title);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = 'Cari ' + title + ' di YouTube';
            song.replaceChildren(link);
        });

        // Jika sumber foto artis tidak dapat dibuka, tampilkan foto pantai asli.
        const photo = card.querySelector('.artist-photo');
        photo.addEventListener('error', function () {
            if (photo.classList.contains('fallback-photo')) return;
            photo.classList.add('fallback-photo');
            photo.src = 'pantai.png';
        });
        if (photo.complete && photo.naturalWidth === 0) {
            photo.classList.add('fallback-photo');
            photo.src = 'pantai.png';
        }
    });

    // Mode siang/malam.
    const theme = document.createElement('button');
    theme.type = 'button';
    theme.className = 'theme-toggle';
    header.appendChild(theme);

    try {
        if (localStorage.getItem('oceanNight') === 'yes')
            document.body.classList.add('night');
    } catch (error) { /* Lanjut dengan mode siang. */ }

    function showTheme() {
        theme.textContent = document.body.classList.contains('night') ? '☀ Day' : '☾ Night';
    }
    showTheme();

    theme.addEventListener('click', function () {
        const night = document.body.classList.toggle('night');
        try { localStorage.setItem('oceanNight', night ? 'yes' : 'no'); }
        catch (error) { /* Mode tetap bisa diganti. */ }
        showTheme();
    });
});
