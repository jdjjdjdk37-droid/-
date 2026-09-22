// ═══════════════════════════════════════════════════════════════
//  الإعدادات
// ═══════════════════════════════════════════════════════════════

const CHANNELS_URL = 'channels.txt';

let allChannels = [];
let filteredChannels = [];
let currentFilter = 'all';
let currentSearch = '';
let currentPlayingIndex = -1;
let favorites = [];
let hls = null;

const CHUNK_SIZE = 50;
let displayedCount = 0;

// ═══════════════════════════════════════════════════════════════
//  التهيئة
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 بدء التطبيق');
    loadFavorites();
    loadChannels();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('clearSearch').addEventListener('click', clearSearch);
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.getElementById('favBtn').addEventListener('click', openFavorites);
    document.getElementById('favToggle').addEventListener('click', toggleCurrentFavorite);
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter, btn));
    });
    
    window.addEventListener('scroll', handleScroll);
}

// ═══════════════════════════════════════════════════════════════
//  تحميل القنوات
// ═══════════════════════════════════════════════════════════════

async function loadChannels() {
    console.log('📥 جلب القنوات من:', CHANNELS_URL);
    
    try {
        const response = await fetch(CHANNELS_URL);
        console.log('📡 Status:', response.status);
        
        if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        
        const text = await response.text();
        console.log('📄 حجم الملف:', text.length, 'حرف');
        console.log('📝 أول 200 حرف:', text.substring(0, 200));
        
        parseChannels(text);
    } catch (e) {
        console.error('❌ فشل التحميل:', e);
        document.getElementById('channelsGrid').innerHTML = `
            <div class="loading">
                <div class="error-icon">❌</div>
                <h3>فشل تحميل القنوات</h3>
                <p>${e.message}</p>
                <p style="font-size: 12px; margin-top: 10px; color: #666;">
                    الرابط: ${CHANNELS_URL}
                </p>
                <button onclick="location.reload()" class="retry-btn" style="margin-top:20px">🔄 إعادة المحاولة</button>
            </div>
        `;
        document.getElementById('stats').innerHTML = '<span>❌ خطأ في التحميل</span>';
    }
}

function parseChannels(text) {
    allChannels = [];
    const lines = text.split('\n');
    
    console.log('🔍 عدد الأسطر:', lines.length);
    
    let skipped = 0;
    let parsed = 0;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // صيغة: الاسم | المجموعة | الرابط
        if (trimmed.includes('|')) {
            const parts = trimmed.split('|').map(p => p.trim());
            if (parts.length >= 3) {
                const name = parts[0].replace(/^\d+\.\s*/, '').trim();
                const group = parts[1];
                const url = parts[2];
                
                if (!url.startsWith('http')) {
                    skipped++;
                    continue;
                }
                
                allChannels.push({
                    id: allChannels.length,
                    name: name,
                    group: group,
                    url: url,
                    logo: ''
                });
                parsed++;
            } else {
                skipped++;
            }
        }
        // رابط فقط
        else if (trimmed.startsWith('http')) {
            allChannels.push({
                id: allChannels.length,
                name: `قناة ${allChannels.length + 1}`,
                group: 'عام',
                url: trimmed,
                logo: ''
            });
            parsed++;
        } else {
            skipped++;
        }
    }
    
    console.log('✅ تم تحليل:', parsed, 'قناة');
    console.log('⏭️ تم تجاهل:', skipped, 'سطر');
    
    if (allChannels.length === 0) {
        document.getElementById('channelsGrid').innerHTML = `
            <div class="loading">
                <div class="error-icon">⚠️</div>
                <h3>الملف فارغ أو بصيغة خاطئة</h3>
                <p>تأكد أن الملف يحتوي على أسطر بصيغة:</p>
                <code style="display:block; margin:15px 0; padding:10px; background:#1A1A2E; border-radius:8px; font-size:12px; text-align:left; direction:ltr;">
                    1. اسم القناة | Sports | https://example.com/stream.m3u8
                </code>
                <button onclick="location.reload()" class="retry-btn" style="margin-top:20px">🔄 إعادة المحاولة</button>
            </div>
        `;
        return;
    }
    
    filteredChannels = [...allChannels];
    updateStats();
    renderChannels(true);
}

// ═══════════════════════════════════════════════════════════════
//  العرض
// ═══════════════════════════════════════════════════════════════

function renderChannels(reset = false) {
    const grid = document.getElementById('channelsGrid');
    
    if (reset) {
        grid.innerHTML = '';
        displayedCount = 0;
    }
    
    if (filteredChannels.length === 0) {
        grid.innerHTML = `
            <div class="loading">
                <div class="error-icon">🔍</div>
                <h3>لا توجد نتائج</h3>
                <p>جرّب كلمة بحث أخرى</p>
            </div>
        `;
        return;
    }
    
    const end = Math.min(displayedCount + CHUNK_SIZE, filteredChannels.length);
    const chunk = filteredChannels.slice(displayedCount, end);
    
    const fragment = document.createDocumentFragment();
    chunk.forEach((ch, i) => {
        const index = displayedCount + i;
        fragment.appendChild(createChannelCard(ch, index));
    });
    
    const loading = grid.querySelector('.loading');
    if (loading) loading.remove();
    
    grid.appendChild(fragment);
    displayedCount = end;
}

function createChannelCard(channel, index) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.dataset.index = index;
    
    const isFav = favorites.some(f => f.url === channel.url);
    
    card.innerHTML = `
        <div class="channel-fav ${isFav ? 'active' : ''}" data-url="${escapeHtml(channel.url)}">
            ${isFav ? '❤️' : '🤍'}
        </div>
        <div class="channel-logo">📺</div>
        <div class="channel-name">${escapeHtml(channel.name)}</div>
        <div class="channel-group">${escapeHtml(channel.group)}</div>
    `;
    
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('channel-fav')) {
            e.stopPropagation();
            toggleFavorite(channel);
            return;
        }
        playChannel(index);
    });
    
    return card;
}

function handleScroll() {
    if (displayedCount >= filteredChannels.length) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    if (scrollTop + clientHeight >= scrollHeight - 500) {
        renderChannels();
    }
}

// ═══════════════════════════════════════════════════════════════
//  المشغل — نسخة محسّنة مع تشخيص
// ═══════════════════════════════════════════════════════════════

function playChannel(index) {
    const channel = filteredChannels[index];
    if (!channel) return;
    
    console.log('▶️ تشغيل:', channel.name);
    console.log('🔗 الرابط:', channel.url);
    console.log('🔒 HTTPS؟', channel.url.startsWith('https://'));
    
    currentPlayingIndex = index;
    
    document.getElementById('playerChannelName').textContent = channel.name;
    document.getElementById('playerChannelGroup').textContent = channel.group;
    document.getElementById('playerOverlay').classList.add('active');
    document.getElementById('playerError').hidden = true;
    
    // تحذير HTTP
    if (channel.url.startsWith('http://')) {
        showToast('⚠️ القناة تعمل على HTTP — قد لا تعمل');
    }
    
    updateFavToggle();
    playVideo(channel.url);
}

function playVideo(url) {
    const video = document.getElementById('video');
    
    // إيقاف التشغيل الحالي
    if (hls) {
        hls.destroy();
        hls = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    
    // تحديث رسالة الخطأ
    document.getElementById('errorMessage').textContent = 'جاري المحاولة...';
    
    // جرّب HLS.js أولاً
    if (Hls.isSupported()) {
        console.log('🎬 استخدام HLS.js');
        
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            manifestLoadingTimeOut: 15000,
            manifestLoadingMaxRetry: 3,
            xhrSetup: (xhr) => {
                xhr.withCredentials = false;
            },
        });
        
        hls.loadSource(url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ تم تحميل manifest');
            video.play().catch(e => {
                console.warn('Autoplay فشل:', e);
                showToast('اضغط ▶️ للتشغيل');
            });
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ HLS Error:', data);
            console.error('   النوع:', data.type);
            console.error('   التفاصيل:', data.details);
            console.error('   Fatal:', data.fatal);
            
            if (data.fatal) {
                let msg = 'فشل التشغيل';
                
                if (data.type === 'networkError') {
                    msg = 'فشل الاتصال بالخادم';
                    if (url.startsWith('http://') && location.protocol === 'https:') {
                        msg = '⚠️ قناة HTTP محجوبة على HTTPS';
                    }
                } else if (data.type === 'mediaError') {
                    msg = 'خطأ في الفيديو';
                }
                
                showError(msg);
            }
        });
    }
    // iOS Safari
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('🎬 iOS Safari native HLS');
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.warn(e));
        }, { once: true });
    }
    else {
        console.error('❌ المتصفح لا يدعم HLS');
        showError('متصفحك لا يدعم HLS — جرّب Chrome أو Safari');
    }
    
    video.addEventListener('error', (e) => {
        console.error('❌ Video error:', e);
        showError('فشل تحميل الفيديو');
    }, { once: true });
}

function showError(message) {
    document.getElementById('playerError').hidden = false;
    document.getElementById('errorMessage').textContent = message;
}

function closePlayer() {
    const video = document.getElementById('video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    
    if (hls) {
        hls.destroy();
        hls = null;
    }
    
    document.getElementById('playerOverlay').classList.remove('active');
    currentPlayingIndex = -1;
}

function retryPlay() {
    if (currentPlayingIndex >= 0) {
        const channel = filteredChannels[currentPlayingIndex];
        if (channel) {
            document.getElementById('playerError').hidden = true;
            playVideo(channel.url);
        }
    }
}

function copyUrl() {
    if (currentPlayingIndex < 0) return;
    const url = filteredChannels[currentPlayingIndex].url;
    navigator.clipboard.writeText(url).then(() => {
        showToast('✅ تم نسخ الرابط');
    });
}

function shareChannel() {
    if (currentPlayingIndex < 0) return;
    const ch = filteredChannels[currentPlayingIndex];
    
    if (navigator.share) {
        navigator.share({
            title: ch.name,
            text: `شاهد ${ch.name}`,
            url: ch.url
        });
    } else {
        copyUrl();
    }
}

function openExternal() {
    if (currentPlayingIndex < 0) return;
    const url = filteredChannels[currentPlayingIndex].url;
    window.open(url, '_blank');
}

// ═══════════════════════════════════════════════════════════════
//  البحث والفلترة
// ═══════════════════════════════════════════════════════════════

function handleSearch(e) {
    currentSearch = e.target.value.toLowerCase().trim();
    document.getElementById('clearSearch').hidden = !currentSearch;
    applyFilters();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentSearch = '';
    document.getElementById('clearSearch').hidden = true;
    applyFilters();
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
}

function applyFilters() {
    filteredChannels = allChannels.filter(ch => {
        if (currentFilter !== 'all') {
            const g = (ch.group || '').toLowerCase();
            const n = (ch.name || '').toLowerCase();
            
            const filterMap = {
                sports: ['sport', 'رياض'],
                news: ['news', 'أخبار', 'اخبار'],
                arabic: ['arabic', 'عربي', 'عربية'],
                iraq: ['iraq', 'عراق'],
                kids: ['kid', 'أطفال', 'اطفال', 'طفل']
            };
            
            const keywords = filterMap[currentFilter] || [];
            const match = keywords.some(k => g.includes(k) || n.includes(k));
            if (!match) return false;
        }
        
        if (currentSearch) {
            const searchIn = `${ch.name} ${ch.group}`.toLowerCase();
            if (!searchIn.includes(currentSearch)) return false;
        }
        
        return true;
    });
    
    updateStats();
    renderChannels(true);
    window.scrollTo(0, 0);
}

function updateStats() {
    const stats = document.getElementById('stats');
    const total = allChannels.length;
    const shown = filteredChannels.length;
    
    if (shown === total) {
        stats.innerHTML = `<span>📺 ${total} قناة</span>`;
    } else {
        stats.innerHTML = `<span>🔍 ${shown} من ${total}</span>`;
    }
}

// ═══════════════════════════════════════════════════════════════
//  المفضلة
// ═══════════════════════════════════════════════════════════════

function loadFavorites() {
    try {
        const saved = localStorage.getItem('favorites');
        favorites = saved ? JSON.parse(saved) : [];
    } catch {
        favorites = [];
    }
}

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function toggleFavorite(channel) {
    const idx = favorites.findIndex(f => f.url === channel.url);
    if (idx >= 0) {
        favorites.splice(idx, 1);
        showToast('💔 تم الحذف من المفضلة');
    } else {
        favorites.push({ name: channel.name, url: channel.url, group: channel.group });
        showToast('❤️ تم الإضافة للمفضلة');
    }
    saveFavorites();
    updateFavToggle();
    
    document.querySelectorAll('.channel-card').forEach(card => {
        const favBtn = card.querySelector('.channel-fav');
        if (!favBtn) return;
        const url = favBtn.dataset.url;
        const isFav = favorites.some(f => f.url === url);
        favBtn.classList.toggle('active', isFav);
        favBtn.textContent = isFav ? '❤️' : '🤍';
    });
    
    renderFavorites();
}

function toggleCurrentFavorite() {
    if (currentPlayingIndex < 0) return;
    const ch = filteredChannels[currentPlayingIndex];
    toggleFavorite(ch);
}

function updateFavToggle() {
    if (currentPlayingIndex < 0) return;
    const ch = filteredChannels[currentPlayingIndex];
    const isFav = favorites.some(f => f.url === ch.url);
    document.getElementById('favToggle').textContent = isFav ? '❤️' : '🤍';
}

function openFavorites() {
    renderFavorites();
    document.getElementById('favSidebar').classList.add('active');
}

function closeFavorites() {
    document.getElementById('favSidebar').classList.remove('active');
}

function renderFavorites() {
    const list = document.getElementById('favoritesList');
    
    if (favorites.length === 0) {
        list.innerHTML = '<p class="empty-msg">لا توجد قنوات في المفضلة</p>';
        return;
    }
    
    list.innerHTML = favorites.map((fav, i) => `
        <div class="fav-item" data-index="${i}">
            <div class="fav-item-logo">📺</div>
            <div class="fav-item-info">
                <div class="fav-item-name">${escapeHtml(fav.name)}</div>
                <div class="fav-item-group">${escapeHtml(fav.group || '')}</div>
            </div>
            <button class="fav-remove" data-index="${i}">✕</button>
        </div>
    `).join('');
    
    list.querySelectorAll('.fav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('fav-remove')) return;
            const i = parseInt(item.dataset.index);
            playExternalChannel(favorites[i]);
        });
    });
    
    list.querySelectorAll('.fav-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(favorites[parseInt(btn.dataset.index)]);
        });
    });
}

function playExternalChannel(channel) {
    document.getElementById('playerChannelName').textContent = channel.name;
    document.getElementById('playerChannelGroup').textContent = channel.group || '';
    document.getElementById('playerOverlay').classList.add('active');
    document.getElementById('playerError').hidden = true;
    
    closeFavorites();
    playVideo(channel.url);
    currentPlayingIndex = -1;
}

// ═══════════════════════════════════════════════════════════════
//  أدوات
// ═══════════════════════════════════════════════════════════════

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
    }[m]));
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    document.getElementById('themeBtn').textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
}
