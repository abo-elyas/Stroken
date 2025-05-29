const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
// Removed: const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

let allGamesData = [];
let activeUsersCount = 0;

io.on('connection', (socket) => {
    activeUsersCount++;
    console.log('A user connected. Current active users:', activeUsersCount);

    socket.emit('active_users_update', activeUsersCount);
    socket.broadcast.emit('active_users_update', activeUsersCount);

    socket.on('disconnect', () => {
        activeUsersCount--;
        console.log('A user disconnected. Current active users:', activeUsersCount);
        io.emit('active_users_update', activeUsersCount);
    });
});

async function loadGamesData() {
    return new Promise((resolve, reject) => {
        const games = [];
        fs.createReadStream(path.join(__dirname, 'games.csv'))
            .pipe(csv())
            .on('data', (row) => {
                games.push(row);
            })
            .on('end', () => {
                games.sort((a, b) => {
                    const idA = parseInt(a['public-id'], 10);
                    const idB = parseInt(b['public-id'], 10);
                    if (isNaN(idA) || isNaN(idB)) {
                        return a['public-id'].localeCompare(b['public-id']);
                    }
                    return idA - idB;
                });
                allGamesData = games;
                console.log('CSV file successfully processed and games loaded.');
                resolve();
            })
            .on('error', (error) => {
                console.error('Error reading CSV file:', error);
                reject(error);
            });
    });
}

app.get('/api/games', (req, res) => {
    const searchTerm = req.query.q ? req.query.q.toLowerCase() : '';
    const startIndex = parseInt(req.query._start, 10) || 0;
    const limit = parseInt(req.query._limit, 10) || allGamesData.length;

    let filtered = allGamesData;

    if (searchTerm) {
        const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
        filtered = allGamesData.filter(game => {
            const gameNameLower = game.name.toLowerCase();
            const publicIdLower = game['public-id'].toLowerCase();
            return searchWords.every(word =>
                gameNameLower.includes(word) || 
                publicIdLower.includes(word)
            );
        });
    }

    const paginatedGames = filtered.slice(startIndex, startIndex + limit);

    res.setHeader('X-Total-Count', filtered.length);
    res.json(paginatedGames);
});

app.get('/api/active-users', (req, res) => {
    res.json({ activeUsers: activeUsersCount });
});

loadGamesData().then(() => {
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Failed to start server due to data loading error:', err);
});
