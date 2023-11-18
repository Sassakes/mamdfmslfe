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
            console.log("Reconnected to the Discord API.");
            writeToLog("Reconnection OK => ");
            attemptingReconnect = false;
        } else {
            console.log("Connected to the Discord API.");
            writeToLog("Connection OK => ");
        }
    });
    ws.on("close", () => {
        console.log("Disconnected from the Discord API.");
        writeToLog("Connexion KO");
        setTimeout(() => {
            attemptingReconnect = true;
            listen(); // Call the listen function to create a new WebSocket connection
            writeToLog("Reconnecting...");
        }, 1000 * 2);
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

                    const specificLinkRegex = /https:\/\/discord\.com\/channels\/742797926761234463\/1026871730964271134\/\d+/g;

                    const modifiedContent = content
                        .replace(/<@&1042046694461821039>/g, "<@&1174860695024705766>")
                        .replace(/<@&1042044869281058846>/g, "<@&1174860857977614436>")
                        .replace(/<@&1046054066972790854>/g, "<@&1174860927582097429>")
                        .replace(/<@&1042045803306422352>/g, "<@&1174860962680033280>")
                        .replace(/<@&1042045702525698099>/g, "<@&1174860986155532340>")
                        .replace(/<@&1042045057806631032>/g, "<@&1174861626906783794>")
                        .replace(/<@&1164126522429411358>/g, "<@&1174861688114270339>")
                        .replace(/<@&1042047880933953546>/g, "<@&1174861716530679949>")
                        .replace(/<@&1103037910145581066>/g, "<@&1174861764849045554>")
                        .replace(/<@&1042048192302305280>/g, "<@&1174880746477981849>")
                        .replace(/<@&1042047726680027166>/g, "<@&1175355541674012732>")
                        .replace(/<#1026446400206143589>/g, "<#1173385962278105098>")
                        .replace(/<#1026446456674078762>/g, "<#1173385759726768128>")
                        .replace(/<#1026446611884290048>/g, "<#1173385612938711080>")
                        .replace(/<#1026446478610276412>/g, "<#1173385565027180576>")
                        .replace(/<#1026446621023686690>/g, "<#1173385614096334979>")
                        .replace(/<#1026446506665967696>/g, "<@&1175396591847362600>")
                        .replace(/<#1026446573342818334>/g, "<@&1174860927582097429>")
                        .replace(/<:Long:1047616390758141973>/g, "<:Long111:1174478590201561118>")
                        .replace(/<:Short:1047616547868381194>/g, "<:Short111:1174478849371811931>")
                        .replace(specificLinkRegex, " - ")
                        .replace(/<#1026446591869063238>/g, "<#1173385522656325773>");

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
        const logFilePath = path.join("/var/www/wealthbuilders.group/WWG/corner", "activequestion.log");
        const logMessage = `${status} at ${new Date().toISOString()}\n`;

        fs.appendFile(logFilePath, logMessage, err => {
            if (err) {
                console.error("Error writing to log file", err);
            }
        });
    }
};
