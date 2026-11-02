// My Music Playlist — semua interaksi ditulis di JavaScript terpisah.
(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.artist-card')];
  const search = document.getElementById('searchInput');
  const genre = document.getElementById('genreFilter');
  const count = document.getElementById('artistCount');
  const noResults = document.getElementById('noResults');
  const themeButton = document.getElementById('themeToggle');
  const API = 'https://musicbrainz.org/ws/2';
  let lastRequestTime = 0;
  let requestQueue = Promise.resolve();

  function updateFilter() {
    const text = search.value.toLocaleLowerCase('id').trim();
    const group = genre.value;
    let visible = 0;
    for (const card of cards) {
      const includesText = card.textContent.toLocaleLowerCase('id').includes(text);
      const genreMatches = group === 'all' || card.dataset.genre === group;
      card.hidden = !(includesText && genreMatches);
      if (!card.hidden) visible += 1;
    }
    count.textContent = `${visible} dari ${cards.length} artis`;
    noResults.hidden = visible > 0;
  }
  search.addEventListener('input', updateFilter);
  genre.addEventListener('change', updateFilter);
  updateFilter();

  // Simpan pilihan mode dalam browser.
  try { if (localStorage.getItem('oceanNight') === 'yes') document.body.classList.add('night'); } catch (_) {}
  function updateThemeLabel() {
    themeButton.innerHTML = document.body.classList.contains('night') ? '☼ <span>Day</span>' : '☾ <span>Night</span>';
  }
  updateThemeLabel();
  themeButton.addEventListener('click', () => {
    const night = document.body.classList.toggle('night');
    try { localStorage.setItem('oceanNight', night ? 'yes' : 'no'); } catch (_) {}
    updateThemeLabel();
  });

  for (const card of cards) {
    const button = card.querySelector('.favorite-btn');
    const name = card.dataset.name;
    let saved = false;
    try { saved = localStorage.getItem(`favorite:${name}`) === 'yes'; } catch (_) {}
    function renderHeart() {
      button.textContent = saved ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(saved));
      button.title = saved ? 'Hapus dari favorit' : 'Tambahkan ke favorit';
    }
    renderHeart();
    button.addEventListener('click', () => {
      saved = !saved;
      try { localStorage.setItem(`favorite:${name}`, saved ? 'yes' : 'no'); } catch (_) {}
      renderHeart();
    });

    // Bila situs pemilik foto membatasi akses, pakai foto pantai lokal pengguna.
    const photo = card.querySelector('.artist-photo');
    function useBeachFallback() {
      if (photo.classList.contains('fallback-photo')) return;
      photo.classList.add('fallback-photo');
      photo.src = 'pantai.png';
      photo.alt = `Suasana pantai — ${name}`;
    }
    photo.addEventListener('error', useBeachFallback, {once:true});
    if (photo.complete && !photo.naturalWidth) useBeachFallback();
  }

  // Permintaan album tambahan via MusicBrainz (perlu internet).
  // Jeda antarpanggilan agar tidak melebihi batas sekitar 1 request/detik.
  function musicBrainz(url) {
    const next = requestQueue.then(async () => {
      const delay = Math.max(0, 1200 - (Date.now() - lastRequestTime));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      lastRequestTime = Date.now();
      const response = await fetch(url, {headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
    requestQueue = next.catch(() => {});
    return next;
  }

  function normalise(s) {
    return String(s).toLocaleLowerCase('id').replace(/[^\p{L}\p{N}]/gu, '');
  }
  function makeSongLink(artist, title) {
    const a = document.createElement('a');
    a.textContent = title;
    a.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${artist} ${title}`);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = `Cari ${title} di YouTube`;
    return a;
  }
  async function findArtistId(name) {
    const query = encodeURIComponent(`artist:"${name}"`);
    const response = await musicBrainz(`${API}/artist/?query=${query}&limit=10&fmt=json`);
    const candidates = response.artists || [];
    const exact = candidates.find(a => a.name.toLowerCase() === name.toLowerCase());
    const chosen = exact || candidates[0];
    if (!chosen) throw new Error('Artis tidak ditemukan');
    return chosen.id;
  }
  async function getAllAlbumGroups(id) {
    const all = [];
    let offset = 0;
    while (true) {
      const data = await musicBrainz(`${API}/release-group?artist=${encodeURIComponent(id)}&type=album&limit=100&offset=${offset}&fmt=json`);
      const part = data['release-groups'] || [];
      all.push(...part);
      offset += part.length;
      if (!part.length || offset >= (data['release-group-count'] || 0)) break;
    }
    return all.filter(album => album['primary-type'] === 'Album')
      .sort((a,b) => (a['first-release-date'] || '9999').localeCompare(b['first-release-date'] || '9999'));
  }
  async function albumTracklist(groupId) {
    const releases = await musicBrainz(`${API}/release?release-group=${encodeURIComponent(groupId)}&limit=25&fmt=json`);
    const candidates = releases.releases || [];
    const choice = candidates.find(r => r.status === 'Official' && r.country === 'XW')
      || candidates.find(r => r.status === 'Official') || candidates[0];
    if (!choice) throw new Error('Rilisan tidak ditemukan');
    const full = await musicBrainz(`${API}/release/${encodeURIComponent(choice.id)}?inc=recordings&fmt=json`);
    return (full.media || []).flatMap(m => (m.tracks || []).map(t => t.title || t.recording?.title).filter(Boolean));
  }
  function makeAlbum(artist, data) {
    const details = document.createElement('details');
    details.className = 'album';
    details.dataset.album = data.title;
    const summary = document.createElement('summary');
    const name = document.createElement('span');
    name.className = 'album-name';
    name.textContent = data.title;
    const meta = document.createElement('span');
    meta.className = 'album-year';
    meta.textContent = (data['first-release-date'] || '').slice(0, 4) || 'Tahun tidak tercantum';
    summary.append(name, meta);
    details.appendChild(summary);
    let loaded = false;
    details.addEventListener('toggle', async () => {
      if (!details.open || loaded) return;
      loaded = true;
      const info = document.createElement('p');
      info.className = 'album-status';
      info.textContent = 'Sedang memuat daftar lagu...';
      details.appendChild(info);
      try {
        const titles = await albumTracklist(data.id);
        if (!titles.length) throw new Error('Daftar lagu tidak tersedia');
        const ol = document.createElement('ol');
        ol.className = 'tracklist';
        for (const title of titles) {
          const li = document.createElement('li');
          li.appendChild(makeSongLink(artist, title));
          ol.appendChild(li);
        }
        info.replaceWith(ol);
        meta.textContent += ` · ${titles.length} songs`;
        updateFilter();
      } catch (e) {
        info.textContent = 'Lagu belum bisa dimuat. Tutup dan buka lagi untuk mencoba.';
        loaded = false;
        info.remove();
      }
    });
    return details;
  }

  for (const card of cards) {
    const button = card.querySelector('.load-more');
    const extra = card.querySelector('.extra-albums');
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Mencari album dari MusicBrainz...';
      try {
        const artist = card.dataset.name;
        const id = await findArtistId(artist);
        const albums = await getAllAlbumGroups(id);
        const known = new Set([...card.querySelectorAll('.album')].map(a => normalise(a.dataset.album)));
        let added = 0;
        for (const album of albums) {
          const key = normalise(album.title);
          if (known.has(key)) continue;
          known.add(key);
          extra.appendChild(makeAlbum(artist, album));
          added++;
        }
        button.textContent = added ? `${added} album tambahan ditemukan ✓` : 'Belum ada album tambahan';
        updateFilter();
      } catch (e) {
        extra.textContent = 'Belum bisa mengambil album online. Pastikan internet aktif, lalu coba lagi.';
        button.textContent = 'Coba lagi ↗';
        button.disabled = false;
      }
    });
  }
})();
