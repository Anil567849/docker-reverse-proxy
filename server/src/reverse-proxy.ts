import express, { Request, Response } from 'express';
import { db } from '.';
export const reveseProxyApp = express();
import httpProxy from 'http-proxy';
import http from 'http';

const proxyServer = httpProxy.createServer();
export const server = http.createServer(reveseProxyApp);


// WebSockets start as an HTTP request and then "upgrade" the connection from HTTP to a WebSocket. The
server.on("upgrade", (req, socket, head) => {
    const hostname = req.headers.host;
    if (!hostname) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
    }

    const subdomain = hostname.split('.')[0];

    if (!db.has(subdomain)) {
        // Send a 404 response and destroy the socket
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }

    const { ipAddress, defaultPort } = db.get(subdomain);

    const reverseProxyUrl = `http://${ipAddress}:${defaultPort}`;

    console.log(`Forwarding to proxy: ${reverseProxyUrl}`);

    // Forward the WebSocket upgrade request
    return proxyServer.ws(req, socket, head, { target: reverseProxyUrl, ws: true });
});

reveseProxyApp.use((req: Request, res: Response) => {
    const subdomain = req.hostname.split('.')[0];

    if(!db.has(subdomain)){
        res.status(404).json({status: "Not Found"});
        return;
    }

    const { ipAddress, defaultPort } = db.get(subdomain);

    const reverseProxyUrl = `http://${ipAddress}:${defaultPort}`;

    console.log(`Forwarding to proxy: ${reverseProxyUrl}`);
    
    return proxyServer.web(req, res, { target: reverseProxyUrl, changeOrigin: true, ws: true });

})