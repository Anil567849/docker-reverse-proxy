"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const express_1 = __importDefault(require("express"));
const managementApp = (0, express_1.default)();
const dockerode_1 = __importDefault(require("dockerode"));
const reverse_proxy_1 = require("./reverse-proxy");
const dockerode = new dockerode_1.default({ socketPath: '/var/run/docker.sock' });
exports.db = new Map();
dockerode.getEvents((error, stream) => {
    if (error) {
        console.log('error in docker events');
        return;
    }
    stream === null || stream === void 0 ? void 0 : stream.on("data", (chunk) => __awaiter(void 0, void 0, void 0, function* () {
        if (!chunk)
            return;
        const event = JSON.parse(chunk.toString());
        if (event.Type === "container" && event.Action == "start") {
            const container = yield dockerode.getContainer(event.id);
            const containerInfo = yield container.inspect();
            const containerName = containerInfo.Name.substring(1); // "/name" we need 'name'
            const ipAddress = containerInfo.NetworkSettings.IPAddress;
            const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
            let defaultPort = null;
            if (exposedPort && exposedPort.length > 0) {
                const [port, type] = exposedPort[0].split('/');
                if (type == 'tcp') {
                    defaultPort = port;
                }
            }
            console.log('Registering', `${containerName}.localhost`, "--------->", `http://${ipAddress}:${defaultPort}`);
            exports.db.set(containerName, { containerName, ipAddress, defaultPort });
        }
    }));
});
managementApp.use(express_1.default.json());
managementApp.post("/containers", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { image, tag = "latest" } = req.body;
    try {
        const images = yield dockerode.listImages();
        const exists = images.find((img) => {
            var _a;
            (_a = img.RepoTags) === null || _a === void 0 ? void 0 : _a.find((tag) => {
                if (tag === `${image}:${tag}`) {
                    return true;
                }
            });
        });
        if (!exists) {
            console.log("Pulling the image:", `${image}:${tag}`);
            yield dockerode.pull(`${image}:${tag}`);
        }
        const container = yield dockerode.createContainer({
            Image: `${image}:${tag}`,
            Tty: false,
            HostConfig: {
                AutoRemove: true,
            }
        });
        yield container.start();
        const subdomain = (yield container.inspect()).Name;
        res.status(200).json({
            status: "success",
            container: `${subdomain}.localhost:80`
        });
    }
    catch (error) {
    }
}));
managementApp.listen(8080, () => console.log("management listening on:", 8080));
reverse_proxy_1.server.listen(80, () => console.log("reverse proxy listening on:", 80));
