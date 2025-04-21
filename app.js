const path = require('path');
const fs = require('fs');
const express = require('express');
const OS = require('os');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const cors = require('cors');
const app = express();
const serverless = require('serverless-http');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(cors());

// MongoDB connection without deprecated options
mongoose.connect(process.env.MONGO_URI, {
    user: process.env.MONGO_USERNAME,
    pass: process.env.MONGO_PASSWORD
}).then(() => {
    // console.log("MongoDB Connection Successful");
}).catch(err => {
    console.error("MongoDB connection error: ", err);
    process.exit(1); // Ensures the app exits if MongoDB connection fails
});

const Schema = mongoose.Schema;

const dataSchema = new Schema({
    name: String,
    id: Number,
    description: String,
    image: String,
    velocity: String,
    distance: String
});

const planetModel = mongoose.model('planets', dataSchema);

// POST /planet route with async/await and proper error handling
app.post('/planet', async function (req, res) {
    try {
        const planetData = await planetModel.findOne({ id: req.body.id });

        if (!planetData) {
            return res.status(404).send("Ooops, we only have 9 planets and a sun. Select a number from 0 - 9");
        }

        res.send(planetData);
    } catch (err) {
        console.error("Error fetching planet data:", err);
        res.status(500).send("Error fetching planet data");
    }
});

// Static file route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/', 'index.html'));
});

// API Docs route
app.get('/api-docs', (req, res) => {
    fs.readFile('oas.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading file');
        }
        res.json(JSON.parse(data));
    });
});

// OS information route
app.get('/os', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        "os": OS.hostname(),
        "env": process.env.NODE_ENV
    });
});

// Health check routes
app.get('/live', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send({ "status": "live" });
});

app.get('/ready', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send({ "status": "ready" });
});

// Start the server
app.listen(3000, () => {
    console.log("Server successfully running on port - 3000");
});

module.exports = app;

// Uncomment for serverless deployment:
// module.exports.handler = serverless(app);
