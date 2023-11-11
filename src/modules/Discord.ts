/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */ // eslint-disable-line max-len
import { WebhookClient, Client, GatewayIntentBits } from "discord.js";
import { channelId, discordToken, headers, serverId, webhookUrl } from "../util/env";
import { Channel, Things } from "../typings";
import fetch from "node-fetch";
import Websocket from "ws";
import fs from 'fs';
import path from 'path';

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)){
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'websocket.log');

const logMessage = (message: string): void => {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  fs.appendFileSync(logFilePath, logEntry);
};

logMessage('Script started.');

function functionName(): void {
    setTimeout(() => {
        logMessage('Tentative de reconnexion...');
        listen();
    }, 5000); // Attend 5 secondes avant de tenter de se reconnecter
}



export const executeWebhook = (things: Things): void => {
    const wsClient = new WebhookClient({ url: things.url });
    wsClient.send(things).catch((e: any) => console.error(e));
};


export const createChannel = async (
    name: string,
    newId: string,
    pos: number,
    parentId?: string
): Promise<Channel> => fetch(`https://discord.com/api/v10/guilds/${newId}/channels`, {
    body: JSON.stringify({
        name,
        parent_id: parentId,
        position: pos
    }),
    headers,
    method: "POST"
}).then(res => res.json()) as Promise<Channel>;

export const listen = (): void => {

     const ws: Websocket = new Websocket(
        "wss://gateway.discord.gg/?v=10&encoding=json"
    );
    let authenticated = false;
    let heartbeatInterval: NodeJS.Timeout; // Pour stocker l'intervalle de battement de cœur

	
    ws.on('open', () => {
        logMessage('WebSocket connection opened.');
        console.log('Connected to the Discord API.');
    });


    ws.on('close', () => {
        logMessage('WebSocket connection closed. Attempting to reconnect.');
        console.log('Disconnected from the Discord API.');
        reconnect(); // Appeler la fonction de reconnexion
    });

    ws.on("message", (data: Websocket.Data) => {
        const payload = JSON.parse(data.toLocaleString());
        const { op, d, s, t } = payload;

        switch (op) {
            case 10:
                // Effacer l'ancien intervalle de battement de cœur s'il existe
                if (heartbeatInterval) clearInterval(heartbeatInterval);

                heartbeatInterval = setInterval(() => {
                    ws.send(
                        JSON.stringify({
                            op: 1,
                            d: s
                        })
                    );
                }, d.heartbeat_interval);
                break;
            case 11:
                if (!authenticated) {
                    authenticated = true;
                    ws.send(
                        JSON.stringify({
                            op: 2,
                            d: {
                                token: discordToken,
                                properties: {
                                    $os: "linux",
                                    $browser: "test",
                                    $device: "test"
                                }
                            }
                        })
                    );
                }
                break;
            case 0:
                if (
                    t === "MESSAGE_CREATE" &&
                    d.guild_id === serverId &&
                    d.channel_id === channelId
                ) {
                    let ext = "jpg";
                    let ub = " [USER]";

                    const {
                        content,
                        attachments,
                        embeds,
                        sticker_items,
                        author
                    } = d;
                    const { avatar, username, id, discriminator } = author;

                    if (avatar?.startsWith("a_")) ext = "gif";
                    if (author.bot) ub = " [BOT]";

                    const things: Things = {
                        avatarURL: avatar
                            ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}`
                            : `https://cdn.discordapp.com/embed/avatars/${
                                discriminator % 5
                            }.png`,
                        content: content ? content : "** **\n",
                        url: webhookUrl,
                        username: `${username}#${discriminator}${ub}`
                    };

                    if (embeds[0]) {
                        things.embeds = embeds;
                    } else if (sticker_items) {
                        things.files = sticker_items.map(
                            (a: any) => `https://media.discordapp.net/stickers/${a.id}.webp`
                        );
                    } else if (attachments[0]) {
                        const fileSizeInBytes = Math.max(
                            ...attachments.map((a: any) => a.size)
                        );
                        const fileSizeInMegabytes =
                            fileSizeInBytes / (1024 * 1024);
                        if (fileSizeInMegabytes < 8) {
                            things.files = attachments.map((a: any) => a.url);
                        } else {
                            things.content += attachments
                                .map((a: any) => a.url)
                                .join("\n");
                        }
                    }
                    executeWebhook(things);
                }
                break;
            default:
                break;
        }
    });

    setInterval(() => {
        if (ws.readyState === Websocket.OPEN) {
            logMessage('WebSocket connection is still open.');
        } else {
            logMessage('WebSocket connection is not open.');
            reconnect(); // Appeler la fonction de reconnexion
        }
    }, 30000); // 30000 ms = 30 secondes
};