// index.js
// Main Express backend file - Enhanced

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { getShopifyOrdersAndTracking, testShopifyConnection } = require('./shopify');
const { testCorreosConnection } = require('./correos');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies

const HARDCODED_USER = {
    username: process.env.APP_USER || "gm",
    password: process.env.APP_PASSWORD || "983f9e455f9c"
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === HARDCODED_USER.username && password === HARDCODED_USER.password) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// API endpoint to get processed orders with optional date filtering
app.get('/api/orders', async (req, res) => {
    try {
        const { startDate, endDate } = req.query; // Get date filters from query parameters
        console.log(`Fetching orders from Shopify. Date filter: Start = ${startDate}, End = ${endDate}`);
        const ordersData = await getShopifyOrdersAndTracking(startDate, endDate);
        res.json(ordersData);
    } catch (error) {
        console.error('Error in /api/orders:', error.message);
        res.status(500).json({ error: 'Failed to fetch order data', details: error.message });
    }
});

// API endpoint to test API connections
app.get('/api/test-connections', async (req, res) => {
    console.log('Testing API connections...');
    try {
        const shopifyStatus = await testShopifyConnection();
        const correosStatus = await testCorreosConnection();

        res.json({
            shopify: shopifyStatus,
            correos: correosStatus
        });
        console.log('API connection test results sent.');
    } catch (error) {
        console.error('Error during API connection test:', error.message);
        res.status(500).json({
            error: 'Failed to perform connection tests',
            details: error.message,
            shopify: { success: false, message: "Test inconclusive due to server error" },
            correos: { success: false, message: "Test inconclusive due to server error" }
        });
    }
});


app.get('/', (req, res) => {
    res.send('Beast COD Tracker Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_STORE_DOMAIN || !process.env.CORREOS_CLIENT_ID || !process.env.CORREOS_SECRET) {
        console.warn('Warning: One or more critical environment variables (Shopify/Correos credentials) are not set. Please check your .env file or Render.com environment settings.');
    }
});
