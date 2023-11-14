/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */ // eslint-disable-line max-len
import { WebhookClient, Client, GatewayIntentBits } from "discord.js";
import { channelId, discordToken, headers, serverId, webhookUrl } from "../util/env";
import { Channel, Things } from "../typings";
import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";
import Websocket from "ws";
let attemptingReconnect = false;
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
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    const ws: Websocket = new Websocket(
        "wss://gateway.discord.gg/?v=10&encoding=json"
    );
    let authenticated = false;

    ws.on("open", () => {
        if (attemptingReconnect) {
            console.log("Reconx API OK");
            writeToLog("Reconx OK =>  ");
            attemptingReconnect = false;
        } else {
            console.log("Conx API ok");
            writeToLog("Conx OK => ");
        }
    });
    ws.on("close", () => {
        console.log("API lost");
        writeToLog("Conx KO");
        setTimeout(() => {
            attemptingReconnect = true;
            listen(); // Call the listen function to create a new WebSocket connection
            writeToLog("Reco");
        }, 1000 * 10);
    });
    ws.on("message", (data: Websocket.Data) => {
        const payload = JSON.parse(data.toLocaleString());
        const { op, d, s, t } = payload;

        switch (op) {
            case 10:
                try {
                    ws.send(
                        JSON.stringify({
                            op: 1,
                            d: s
                        })
                    );
                    setInterval(() => {
                        ws.send(
                            JSON.stringify({
                                op: 1,
                                d: s
                            })
                        );
                    }, d.heartbeat_interval);
                } catch (e) {
                    console.log(e);
                }
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

                    const {
                        content,
                        attachments,
                        embeds,
                        sticker_items,
                        author
                    } = d;
                    const { avatar, username, id, discriminator } = author;

                    if (avatar?.startsWith("a_")) ext = "gif";
                    const modifiedContent = content.replace(/<@&1173758886851919973>/g, "<@&1173761666480078889>");

                    const things: Things = {
                        avatarURL: avatar
                            ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}`
                            : `https://cdn.discordapp.com/embed/avatars/${discriminator % 5}.png`,
                        content: modifiedContent ? modifiedContent : "** **\n",
                        url: webhookUrl,
                        username: `${username}`
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
    function writeToLog(status: string): void {
        const logFilePath = path.join("/var/www/wealthbuilders.group", "test.log");
        const logMessage = `${status} at ${new Date().toISOString()}\n`;

        fs.appendFile(logFilePath, logMessage, err => {
            if (err) {
                console.error("Error writing to log file", err);
            }
        });
    }
};
