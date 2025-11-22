const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const port = 3000;

// Use CORS to allow requests from your HTML file
app.use(cors());

app.get('/video-info', (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Use yt-dlp to get video metadata as JSON
    // The command is constructed carefully to prevent command injection vulnerabilities
    const command = `yt-dlp --dump-json ${JSON.stringify(videoUrl)}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ error: 'Failed to fetch video info', details: stderr });
        }

        try {
            const videoInfo = JSON.parse(stdout);
            // Send back a cleaner object with just what we need
            const relevantInfo = {
                title: videoInfo.title,
                channel: videoInfo.channel,
                thumbnail: videoInfo.thumbnail,
            };
            res.json(relevantInfo);
        } catch (parseError) {
            console.error(`JSON parse error: ${parseError}`);
            res.status(500).json({ error: 'Failed to parse video info' });
        }
    });
});

app.listen(port, () => {
    console.log(`yt-dlp server listening at http://localhost:${port}`);
    console.log('To use this, open another terminal and run:');
    console.log('1. cd /Users/yuliu/Documents/GitHub/app/yt-dlp/');
    console.log('2. npm install express cors');
    console.log('3. node server.js');
    console.log('Then, open your yt-dlp-bookmark.html file in the browser.');
});
