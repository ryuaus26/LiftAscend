const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy middleware options
const options = {
    target: process.env.TARGET_API_URL, // Target server
    changeOrigin: true, // Changes the origin of the host header to the target URL
    pathRewrite: {
        '^/api': '', // Remove '/api' from the request URL
    },
    onProxyReq: (proxyReq, req, res) => {
        // Add your API key to the request headers
        proxyReq.setHeader('Authorization', `Bearer ${process.env.API_KEY}`);
    },
};

// Use the proxy middleware for routes starting with '/api'
app.use('/api', createProxyMiddleware(options));

// Start the server
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});