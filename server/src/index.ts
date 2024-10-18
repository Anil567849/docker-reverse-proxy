import express, { Request, Response } from 'express';
const managementApp = express();
import Docker from 'dockerode';
import { server } from './reverse-proxy';

const dockerode = new Docker({ socketPath: '/var/run/docker.sock' });

export let db = new Map();

dockerode.getEvents((error, stream) => {
    if(error){
        console.log('error in docker events');
        return;
    }

    stream?.on("data", async (chunk) => {
        if(!chunk) return;
        const event = JSON.parse(chunk.toString());

        if(event.Type === "container" && event.Action == "start"){
            const container = await dockerode.getContainer(event.id);
            const containerInfo = await container.inspect();

            const containerName = containerInfo.Name.substring(1); // "/name" we need 'name'
            const ipAddress = containerInfo.NetworkSettings.IPAddress;
            const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
            let defaultPort: null | string = null;
            
            if(exposedPort && exposedPort.length > 0){
                const [port, type] = exposedPort[0].split('/');
                if(type == 'tcp'){
                    defaultPort = port;
                }
            }
            console.log('Registering', `${containerName}.localhost`, "--------->", `http://${ipAddress}:${defaultPort}`);
            db.set(containerName, {containerName, ipAddress, defaultPort});
        }
    })
})

managementApp.use(express.json());

managementApp.post("/containers", async (req: Request, res: Response) => {
    const { image, tag = "latest" } = req.body;

    try {
        const images = await dockerode.listImages();
        const exists = images.find((img) => {
            img.RepoTags?.find((tag) => {
                if (tag === `${image}:${tag}`) {
                    return true;
                }
            })
        });
        
        if (!exists) {
            console.log("Pulling the image:", `${image}:${tag}`);
            await dockerode.pull(`${image}:${tag}`);
        }

        const container = await dockerode.createContainer({
            Image: `${image}:${tag}`,
            Tty: false,
            HostConfig: {
                AutoRemove: true,
            }
        })

        await container.start();
        const subdomain = (await container.inspect()).Name
        res.status(200).json({
            status: "success",
            container: `${subdomain}.localhost:80`
        })
    } catch (error) {
        res.status(500).json({
            status: "failed"
        })
    }

})

managementApp.listen(8080, () => console.log("management listening on:", 8080));
server.listen(80, () => console.log("reverse proxy listening on:", 80))