const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
// Increase payload limit because base64 strings can be large
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

// Ensure labels directory exists
const labelsDir = path.join(__dirname, 'labels');
if (!fs.existsSync(labelsDir)) {
    fs.mkdirSync(labelsDir, { recursive: true });
}

// Endpoint to save an image
app.post('/save-image', (req, res) => {
    const { imageBase64, label } = req.body;

    if (!imageBase64 || !label) {
        return res.status(400).json({ error: 'Missing imageBase64 or label' });
    }

    // Sanitize label name to prevent directory traversal
    const safeLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const personDir = path.join(labelsDir, safeLabel);

    // Create the specific person's directory if it doesn't exist
    if (!fs.existsSync(personDir)) {
        fs.mkdirSync(personDir, { recursive: true });
    }

    // Process base64 string
    // Strip the "data:image/jpeg;base64," part
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    // Create a unique filename based on timestamp
    const fileName = `snap_${Date.now()}.jpg`;
    const filePath = path.join(personDir, fileName);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error('Error saving image:', err);
            return res.status(500).json({ error: 'Failed to save image' });
        }
        res.json({ success: true, message: `Saved ${fileName} to ${safeLabel}` });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser.`);
});
await tf.setBackend('webgl');
await tf.ready();