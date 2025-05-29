let allGames = [];
let filteredGames = [];
let gamesPerLoad = 24;
let currentLoadIndex = 0;
let isLoading = false;
let allGamesLoaded = false;
const gameListDiv = document.getElementById('game-list');
const searchInput = document.getElementById('search-input');
const loadingIndicator = document.getElementById('loading-indicator');
const observerTarget = document.getElementById('observer-target');
const gameCountElement = document.getElementById('game-count');
const activeUsersCountElement = document.getElementById('active-users-count');

// Initialize Socket.IO connection
const socket = io(); // Connects to the server where the script is served from

// Listen for active users updates from the server
socket.on('active_users_update', (count) => {
    activeUsersCountElement.textContent = `${count.toLocaleString()} Active Users`;
});


function updateGameCountDisplay() {
    gameCountElement.textContent = filteredGames.length;
}

function appendGamesToDisplay(gamesToAppend) {
    gamesToAppend.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card bg-gray-900 rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition duration-300 ease-in-out';
        gameCard.innerHTML = `
            <img src="https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game['public-id']}/header.jpg" alt="${game.name} Banner" class="game-banner" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/460x215/333333/ffffff?text=Game+Banner';">
            <div class="game-info">
                <h2 class="text-2xl font-bold text-blue-400 mb-2">${game.name}</h2>
                <p class="text-gray-400 text-base font-medium mb-4">AppID: ${game['public-id']}</p>
                <button data-game-public-id="${game['public-id']}" data-game-secret-id="${game['secret-id']}" class="download-button bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-3 px-5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 ease-in-out w-full">
                    Get Files
                </button>
            </div>
        `;
        gameListDiv.appendChild(gameCard);
    });
    document.querySelectorAll('.download-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const secretId = event.target.dataset.gameSecretId;
            handleDownload(secretId);
        });
    });
}

async function fetchGamesFromServer(searchTerm = '', startIndex, limit) {
    isLoading = true;
    loadingIndicator.classList.remove('hidden');
    if (!searchTerm && startIndex > 0) {
        loadingIndicator.textContent = "Loading more games...";
    } else if (searchTerm) {
        loadingIndicator.textContent = "Searching...";
    }

    let url = `/api/games?_start=${startIndex}&_limit=${limit}`;
    if (searchTerm) {
        url += `&q=${encodeURIComponent(searchTerm)}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const totalCount = parseInt(response.headers.get('X-Total-Count'), 10);
        return { games: data, totalCount: totalCount };
    } catch (error) {
        console.error("Error fetching games:", error);
        loadingIndicator.textContent = "Failed to load games.";
        return { games: [], totalCount: 0 };
    } finally {
        isLoading = false;
    }
}

async function loadMoreGames() {
    if (isLoading || allGamesLoaded) {
        return;
    }

    const { games: newGames, totalCount } = await fetchGamesFromServer(searchInput.value.trim(), currentLoadIndex, gamesPerLoad);

    if (newGames.length > 0) {
        appendGamesToDisplay(newGames);
        currentLoadIndex += newGames.length;
        if (currentLoadIndex >= totalCount) {
            allGamesLoaded = true;
            loadingIndicator.classList.add('hidden');
        }
    } else {
        allGamesLoaded = true;
        if (filteredGames.length === 0 && searchInput.value.trim()) {
            loadingIndicator.textContent = "No games found matching your search.";
        } else if (filteredGames.length === 0) {
            loadingIndicator.textContent = "No games available.";
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }
}

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && !allGamesLoaded) {
        loadMoreGames();
    }
}, {
    root: null,
    rootMargin: '0px 0px 1200px 0px',
    threshold: 0.1
});

// Initial fetch for active users on page load
async function fetchInitialActiveUsers() {
    try {
        const response = await fetch('/api/active-users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        activeUsersCountElement.textContent = `${data.activeUsers.toLocaleString()} Active Users`;
    } catch (error) {
        console.error("Error fetching initial active users:", error);
        activeUsersCountElement.textContent = 'N/A';
    }
}


function handleDownload(secretId) {
    window.open(`https://ouo.io/${secretId}`, '_blank');
}

async function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    gameListDiv.innerHTML = '';
    currentLoadIndex = 0;
    allGamesLoaded = false;
    isLoading = true;

    const { games: initialGames, totalCount } = await fetchGamesFromServer(searchTerm, 0, gamesPerLoad);
    
    gameCountElement.textContent = totalCount;

    if (initialGames.length > 0) {
        appendGamesToDisplay(initialGames);
        currentLoadIndex = initialGames.length;
        if (currentLoadIndex >= totalCount) {
            allGamesLoaded = true;
            loadingIndicator.classList.add('hidden');
        } else {
            loadingIndicator.classList.remove('hidden');
            loadingIndicator.textContent = "Scroll to load more...";
        }
    } else if (searchTerm !== '') {
        loadingIndicator.textContent = "No games found matching your search.";
        loadingIndicator.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
        loadingIndicator.textContent = "No games available.";
    }
    isLoading = false;
}

searchInput.addEventListener('input', handleSearch);

document.addEventListener('DOMContentLoaded', async () => {
    // Initial load of games when the page loads
    const { games: initialGames, totalCount: initialTotalCount } = await fetchGamesFromServer('', 0, gamesPerLoad);
    
    gameCountElement.textContent = initialTotalCount; 

    loadingIndicator.classList.remove('hidden');
    loadingIndicator.textContent = "Loading games...";
    loadMoreGames();
    observer.observe(observerTarget);

    // Fetch initial active users count
    fetchInitialActiveUsers();
});
