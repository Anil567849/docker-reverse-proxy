"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.reveseProxyApp = void 0;
const express_1 = __importDefault(require("express"));
const _1 = require(".");
exports.reveseProxyApp = (0, express_1.default)();
const http_proxy_1 = __importDefault(require("http-proxy"));
const http_1 = __importDefault(require("http"));
const proxyServer = http_proxy_1.default.createServer();
exports.server = http_1.default.createServer(exports.reveseProxyApp);
exports.server.on("upgrade", (req, socket, head) => {
    const hostname = req.headers.host;
    if (!hostname) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
    }
    const subdomain = hostname.split('.')[0];
    if (!_1.db.has(subdomain)) {
        // Send a 404 response and destroy the socket
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }
    const { ipAddress, defaultPort } = _1.db.get(subdomain);
    const reverseProxyUrl = `http://${ipAddress}:${defaultPort}`;
    console.log(`Forwarding to proxy: ${reverseProxyUrl}`);
    // Forward the WebSocket upgrade request
    return proxyServer.ws(req, socket, head, { target: reverseProxyUrl, ws: true });
});
exports.reveseProxyApp.use((req, res) => {
    const subdomain = req.hostname.split('.')[0];
    if (!_1.db.has(subdomain)) {
        res.status(404).json({ status: "Not Found" });
        return;
    }
    const { ipAddress, defaultPort } = _1.db.get(subdomain);
    const reverseProxyUrl = `http://${ipAddress}:${defaultPort}`;
    console.log(`Forwarding to proxy: ${reverseProxyUrl}`);
    return proxyServer.web(req, res, { target: reverseProxyUrl, changeOrigin: true, ws: true });
});
