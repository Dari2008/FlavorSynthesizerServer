import { Express } from "express";
import { MultiplayerEndpointCreateBody, MultiplayerEndpointJoinBody } from "../../@types/Endpoints";
import EndpointUtils from "../utils/EndpointUtils";
import { MULTIPLAYER_CREATE_BODY, MULTIPLAYER_JOIN_BODY } from "../../@types/ApiBodyFormats/Users";
import Utils, { JWTUtils } from "../../utils/Utils";
import { randomInt, UUID } from "node:crypto";
import { DishVolumes, FlavorElement, ServerDish, ServerFlavorSynthLine } from "../../@types/User";
import { MainFlavor } from "../../@types/Flavors";
import { APIResponse, Digit, MultiplayerCreateResponse, MultiplayerJoinResponse, PlayerJoinResponse, ShareDigits } from "../../@types/Api";
import ShareUtils from "../utils/ShareUtils";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import DishManager from "../../sql/DishManager";
import { MultiplayerSocketBodyAddFlavor, MultiplayerSocketBodyAddSynthLine, MultiplayerSocketBodyChangeTrackVolume, MultiplayerSocketBodyChangeVolume, MultiplayerSocketBodyDeselectAllFlavors, MultiplayerSocketBodyDeselectFlavors, MultiplayerSocketBodyInitial, MultiplayerSocketBodyKick, MultiplayerSocketBodyMessage, MultiplayerSocketBodyMute, MultiplayerSocketBodyRemoveFlavors, MultiplayerSocketBodyRemoveSynthLine, MultiplayerSocketBodyRename, MultiplayerSocketBodySave, MultiplayerSocketBodySelectFlavors, MultiplayerSocketBodySelectOnly, MultiplayerSocketBodyUnknown, MultiplayerSocketBodyUpdateFlavors, MultiplayerSocketBodyViewOnly } from "./Bodys";
import Users from "../../sql/Users";

export default class MultiplayerEndpoints {

    public static CURRENT_RUNNING_MULTIPLAYER: Multiplayer.Meeting[] = [];

    public static getOwner(game: Multiplayer.Meeting) {
        return game.users.find(e => e.endpointUUID == game.owner)!;
    }

    public static isOwner(endpointUUID: UUID, game: Multiplayer.Meeting) {
        return game.owner == endpointUUID;
    }

    constructor(app: Express, server: http.Server) {
        this.init(app, server);
    }

    private init(app: Express, server: http.Server) {
        app.post<string, any, APIResponse<MultiplayerJoinResponse>>("/multiplayer/join", async (req, res) => {
            const body = req.body as MultiplayerEndpointJoinBody;
            if (!EndpointUtils.checkAndSend(body, MULTIPLAYER_JOIN_BODY, res)) return;

            const jwt = body.jwt;
            const code = body.code

            const jwtData = jwt ? JWTUtils.checkJWTAndResponse(jwt, res) : null;
            if (!jwtData && jwt) return;

            if (jwtData) {
                const newLoadedName = await Users.getUserName(jwtData.uuid);
                if (typeof newLoadedName == "string") jwtData.username = newLoadedName;
            }

            const name = jwtData?.username ?? body.name;

            const game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => ShareUtils.isShareCodeEqual(e.code, code));

            if (!game) {
                EndpointUtils.sendError(res, "Failed to join meeting", 404);
                return;
            }

            const endpointUUID = Utils.uuidv4Exclude(game.users.map(e => e.endpointUUID));



            const allowConnection = await MultiplayerEndpoints.getOwner(game).connectionHandler?.send<any, PlayerJoinResponse, PlayerJoinResponse>({
                type: "playerJoined",
                joinedPlayer: {
                    endpointUUID: endpointUUID,
                    name: name
                }
            });

            let isMuted = false;
            let isViewOnly = false;

            if (allowConnection != undefined) {
                const playerState = allowConnection.playerState;
                if (playerState) {
                    console.log(playerState);
                    if (playerState.kick) {
                        EndpointUtils.sendError(res, "You were not allowed to join", 401);
                        return;
                    }
                    isMuted = playerState.muted;
                    isViewOnly = playerState.onlyView;
                }
            }

            game.users.push({
                connectionHandler: null,
                endpointUUID,
                userUUID: jwtData?.uuid ?? null,
                selectedFlavors: [],
                name: name,
                isMuted,
                onlyView: isViewOnly
            });

            EndpointUtils.sendOk(res, {
                endpointUUID,
                gameUUID: game.uuid
            });
        });

        app.post<string, any, APIResponse<MultiplayerCreateResponse>>("/multiplayer/create", async (req, res) => {
            const body = req.body as MultiplayerEndpointCreateBody;
            if (!EndpointUtils.checkAndSend(body, MULTIPLAYER_CREATE_BODY, res)) return;

            if (!body.jwt && !body.dish) {
                EndpointUtils.sendError(res, "Failed to create multiplayer meeting", 405);
                return;
            }

            const jwt = body.jwt;

            const jwtData = jwt ? JWTUtils.checkJWTAndResponse(jwt, res) : null;
            if (!jwtData && jwt) return;

            if (jwtData) {
                const newLoadedName = await Users.getUserName(jwtData.uuid);
                if (typeof newLoadedName == "string") jwtData.username = newLoadedName;
            }

            let dish: ServerDish | null = body.dish ?? null;
            const name = jwtData?.username ?? body.name;

            if (body.dishUUID && jwtData) {
                dish = await DishManager.getDish(jwtData.uuid, body.dishUUID);
            }

            if (!dish) {
                EndpointUtils.sendError(res, "Failed to open dish for multipayer", 404);
                return;
            }

            const endpointUUID = Utils.uuidv4();

            const game: Multiplayer.Meeting = createGame(dish, endpointUUID);


            game.users.push({
                connectionHandler: null,
                endpointUUID,
                userUUID: jwtData?.uuid ?? null,
                selectedFlavors: [],
                name: name,
                isMuted: false,
                onlyView: false
            });

            MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.push(game);

            EndpointUtils.sendOk(res, {
                endpointUUID,
                gameUUID: game.uuid,
                code: game.code
            });
        });

        const wss = new WebSocketServer({
            server: server,
            path: "/multiplayer/live"
        });

        wss.on("connection", (ws) => {
            new ConnectionHandler(ws);
        });

    }

}


function generateCode() {
    function generateSingleCode(): ShareDigits {
        return [
            randomInt(0, 9) as Digit,
            randomInt(0, 9) as Digit,
            randomInt(0, 9) as Digit,
            randomInt(0, 9) as Digit,
            randomInt(0, 9) as Digit,
            randomInt(0, 9) as Digit,
        ];
    }

    let code = generateSingleCode();
    while (MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => ShareUtils.isShareCodeEqual(e.code, code))) {
        code = generateSingleCode();
    }
    return code;
}

function generateMeetingUUID() {
    return Utils.uuidv4Exclude(MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.map(e => e.uuid));
}

function createGame(dish: ServerDish, owner: UUID): Multiplayer.Meeting {
    const uuid = generateMeetingUUID();

    const broadcast = <T>(data: T, skip?: UUID) => {
        const game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => e.uuid == uuid);
        if (!game) return false;
        game.users.filter(e => e.endpointUUID !== skip).forEach(user => {
            if (!user.connectionHandler) return;
            user.connectionHandler.sendResponse(data, -1);
        });
        return true;
    };

    const senDataTo = <T>(receiverEndpointUUID: UUID, data: T) => {
        const game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => e.uuid == uuid);
        if (!game) return false;
        game.users.forEach(user => {
            if (!user.connectionHandler) return;
            if (user.endpointUUID != receiverEndpointUUID) return;
            user.connectionHandler.sendResponse(data, -1);
        });
        return true;
    }

    return {
        code: generateCode(),
        mainFlavor: dish.mainFlavor,
        name: dish.name,
        tracks: dish.tracks,
        uuid: uuid,
        volumes: dish.volumes,
        owner: owner,
        users: [],
        broadcast,
        senDataTo
    };
}


class ConnectionHandler {
    private endpointUUID: UUID | undefined;
    private gameUUID: UUID | undefined;
    private game: Multiplayer.Meeting | undefined;
    private ws: WebSocket;
    private user: Multiplayer.User | undefined;
    private callbacks: {
        [key: number]: <T>(data: APIResponse<T>) => void;
    } = {};
    private currentReqId: number = -1;

    constructor(ws: WebSocket) {
        this.ws = ws;
        ws.on("message", this.messageReceived.bind(this));
        ws.on("close", this.closedConnection.bind(this));
        // ws.on("connectToGame", this.onConnectToGame.bind(this));
        // ws.on("addFlavor", this.addFlavor.bind(this));
        // ws.on("addSynthLine", this.addSynthLine.bind(this));
        // ws.on("removedSynthLine", this.removedSynthLine.bind(this));
        // ws.on("removeFlavors", this.removeFlavors.bind(this));
        // ws.on("changeVolume", this.changeVolume.bind(this));
        // ws.on("changeTrackVolume", this.changeTrackVolume.bind(this));
        // ws.on("selectFlavors", this.selectFlavors.bind(this));
        // ws.on("deselectFlavors", this.deselectFlavors.bind(this));
        // ws.on("deselectAllFlavors", this.deselectAllFlavors.bind(this));
        // ws.on("moveFlavors", this.moveFlavors.bind(this));
        // ws.on("resizFlavors", this.resizFlavors.bind(this));
    }

    public close() {
        this.ws.close();
    }

    private async onConnectToGame({ endpointUUID, gameUUID }: MultiplayerSocketBodyInitial) {

        this.game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => e.uuid == gameUUID);
        if (!this.game) {
            return "Game not found";
        }

        this.user = this.game.users.find(e => e.endpointUUID == endpointUUID);

        if (!this.user) {
            return "User not found";
        }
        console.log("Player Joined successfully to Game with UUID", gameUUID, endpointUUID);

        this.game = this.game;
        this.endpointUUID = endpointUUID;
        this.gameUUID = gameUUID;
        this.user.connectionHandler = this;



        return { status: "success", isMuted: this.user.isMuted, isViewOnly: this.user.onlyView };
    };

    private addFlavor({
        flavor,
        from,
        to,
        uuid,
        trackUUID
    }: MultiplayerSocketBodyAddFlavor) {
        const errors = reqireArgsReturn({ uuid, to, from, flavor }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        const track = this.game.tracks.find(e => e.uuid == trackUUID);
        if (!track) return "This track doesn't exist";

        track.elements.push({
            flavor,
            from,
            to,
            uuid
        });

        const success = this.game?.broadcast({
            type: "addFlavor",
            trackUUID,
            flavorData: {
                flavor,
                from,
                to,
                uuid
            }
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private addSynthLine({ synthLineUUID }: MultiplayerSocketBodyAddSynthLine) {
        const errors = reqireArgsReturn({ synthLineUUID }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        this.game.tracks.push({
            uuid: synthLineUUID,
            elements: [],
            muted: false,
            solo: false,
            volume: 100
        });

        const success = this.game?.broadcast({
            type: "addSynthLine",
            synthLineUUID,
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };

    }

    private removedSynthLine({ synthLineUUID }: MultiplayerSocketBodyRemoveSynthLine) {
        const errors = reqireArgsReturn({ synthLineUUID }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        this.game.tracks = this.game.tracks.filter(e => e.uuid != synthLineUUID);

        const success = this.game?.broadcast({
            type: "removeSynthLine",
            synthLineUUID,
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private removeFlavors({ }: MultiplayerSocketBodyRemoveFlavors) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors).map(e => e.flavorUUID);

        const selectedFlavors = this.user.selectedFlavors;


        for (const flavor of selectedFlavors) {
            if (allLockedFlavors.includes(flavor.flavorUUID)) continue;
            const track = this.game.tracks.find(e => e.uuid == flavor.trackUUID);
            if (!track) continue;

            track.elements = track.elements.filter(e => e.uuid !== flavor.flavorUUID);
        }


        const success = this.game?.broadcast({
            type: "removeFlavors",
            selectedFlavors: [...new Set(selectedFlavors)]
        }, this.user.endpointUUID);

        if (!success) return "Failed to send broadcast";
        return { status: "success" };


    }

    private changeVolume({ newVolume, volumeSlot }: MultiplayerSocketBodyChangeVolume) {
        const errors = reqireArgsReturn({ newVolume, volumeSlot }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        this.game.volumes[volumeSlot] = newVolume;

        const success = this.game?.broadcast({
            type: "changeVolume",
            newVolume,
            volumeSlot
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private changeTrackVolume({ newVolume, trackUUID }: MultiplayerSocketBodyChangeTrackVolume) {
        const errors = reqireArgsReturn({ newVolume, trackUUID }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        const track = this.game.tracks.find(e => e.uuid == trackUUID);
        if (!track) return "Couldn't find track";
        track.volume = newVolume;

        const success = this.game?.broadcast({
            type: "changeTrackVolume",
            newVolume,
            trackUUID
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private selectFlavors({ flavorUUIDs }: MultiplayerSocketBodySelectFlavors) {
        const errors = reqireArgsReturn({ flavorUUIDs }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";
        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors).map(e => e.flavorUUID);


        const selectedByOtherUsers = flavorUUIDs.filter(e => allLockedFlavors.includes(e.flavorUUID));
        flavorUUIDs = flavorUUIDs.filter(e => !allLockedFlavors.includes(e.flavorUUID));

        this.user.selectedFlavors = [...new Set([...this.user.selectedFlavors, ...flavorUUIDs])];



        const success = this.game?.broadcast({
            type: "selectFlavors",
            endpointUUID: this.user.endpointUUID,
            flavorUUIDs
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success", selectedByOtherUsers: selectedByOtherUsers.length == 0 ? undefined : selectedByOtherUsers };
    }

    private selectOnly({ flavorUUID }: MultiplayerSocketBodySelectOnly) {
        const errors = reqireArgsReturn({ flavorUUID }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors).map(e => e.flavorUUID);

        if (allLockedFlavors.includes(flavorUUID)) {
            return "Failed to select Flavor";
        }



        const success = this.game?.broadcast({
            type: "selectOnly",
            endpointUUID: this.user.endpointUUID,
            flavorUUID
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private deselectFlavors({ flavorUUIDs }: MultiplayerSocketBodyDeselectFlavors) {
        const errors = reqireArgsReturn({ flavorUUIDs }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        this.user.selectedFlavors = this.user.selectedFlavors.filter(e => !flavorUUIDs.includes(e));

        const success = this.game?.broadcast({
            type: "deselectFlavors",
            endpointUUID: this.user.endpointUUID,
            flavorUUIDs
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private deselectAllFlavors({ }: MultiplayerSocketBodyDeselectAllFlavors) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        this.user.selectedFlavors = [];

        const success = this.game?.broadcast({
            type: "deselectAllFlavors",
            endpointUUID: this.user.endpointUUID
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";
        return { status: "success" };
    }

    private updateFlavors({ flavors }: MultiplayerSocketBodyUpdateFlavors) {
        const errors = reqireArgsReturn({ flavors }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        const tracks = this.game.tracks;
        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors);

        const originalPositions: {
            [key: string]: {
                from: number;
                to: number;
            }
        } = {};

        for (const change of flavors) {
            const track = tracks.find(e => e.uuid == change.trackUUID);
            if (!track) continue;
            const flavor = track.elements.find(e => e.uuid == change.uuid);
            if (!flavor) continue;
            originalPositions[flavor.uuid] = {
                from: flavor.from,
                to: flavor.to
            };
        }

        for (const change of flavors) {
            const track = tracks.find(e => e.uuid == change.trackUUID);
            if (!track) continue;
            const flavor = track.elements.find(e => e.uuid == change.uuid);
            if (!flavor) continue;

            if (allLockedFlavors.map(e => e.flavorUUID).includes(flavor.uuid)) continue;

            flavor.from = change.from;
            flavor.to = change.to;
        }

        const intersects = (flavor1: FlavorElement, flavor2: FlavorElement) => {
            return (flavor1.from >= flavor2.from && flavor1.to <= flavor2.from) || (flavor2.from >= flavor1.from && flavor2.to <= flavor1.from);
        }

        const changedUUIds = flavors.map(e => e.uuid);
        const undoneFlavors = [];

        for (const track of this.game.tracks) {
            const flavors = track.elements;
            for (const flavor1 of flavors) {
                for (const flavor2 of flavors) {
                    if (!intersects(flavor1, flavor2)) continue;

                    const changedFlavor = changedUUIds.includes(flavor1.uuid) ? flavor1 : flavor2;
                    const originalPosition = originalPositions[changedFlavor.uuid];
                    if (!originalPosition) continue;

                    changedFlavor.from = originalPosition.from;
                    changedFlavor.to = originalPosition.to;
                    undoneFlavors.push(changedFlavor.uuid);
                }
            }
        }


        const success = this.game?.broadcast({
            type: "updateFlavors",
            flavors
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";

        return { status: "success", undoneFlavors: undoneFlavors.length == 0 ? undefined : undoneFlavors };
    }

    private rename({ newName }: MultiplayerSocketBodyRename) {
        const errors = reqireArgsReturn({ newName }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";

        this.game.name = newName;

        const success = this.game?.broadcast({
            type: "rename",
            newName
        }, this.user.endpointUUID);
        if (!success) return "Failed to send broadcast";

        return { status: "success" };

    }

    private async save({ }: MultiplayerSocketBodySave) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.isViewOnly()) return "Cant edit";
        const owner = MultiplayerEndpoints.getOwner(this.game);
        if (!owner) {
            return "Couldn't find the owner!";
        }

        owner.connectionHandler?.send({
            type: "save"
        });
        return { status: "success" };
    }

    private async message({ message, time, uuid }: MultiplayerSocketBodyMessage) {
        const errors = reqireArgsReturn({ message, time }, "all");
        if (errors !== true) return errors;
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (this.user.isMuted) return "You are Muted";

        this.game.broadcast({
            type: "chatMessage",
            message: {
                sender: this.user.name,
                message,
                time,
                uuid
            }
        }, this.user.endpointUUID);

        return { status: "success" };
    }

    private async getDish({ }: {}) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        return {
            status: "success",
            dish: {
                mainFlavor: this.game.mainFlavor,
                name: this.game.name,
                tracks: this.game.tracks,
                uuid: this.game.uuid,
                volumes: this.game.volumes,
                createdAt: "now lol",
                createdBy: MultiplayerEndpoints.getOwner(this.game)?.name,
                publishState: "private",
                share: undefined
            } as ServerDish
        }
    }


    public kick({ playerEndpointUUID }: MultiplayerSocketBodyKick) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (!MultiplayerEndpoints.isOwner(this.user.endpointUUID, this.game)) {
            return "You dont have the permissions to do that";
        }

        const target = this.game.users.find(e => e.endpointUUID == playerEndpointUUID);
        if (!target) {
            return "Failed to find user";
        }

        target.connectionHandler?.send({
            type: "kick"
        });

        target.connectionHandler?.close();

        this.game.users = this.game.users.filter(e => e.endpointUUID !== playerEndpointUUID);

        return { status: "success" };
    }

    public mute({ playerEndpointUUID, is }: MultiplayerSocketBodyMute) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (!MultiplayerEndpoints.isOwner(this.user.endpointUUID, this.game)) {
            return "You dont have the permissions to do that";
        }
        const target = this.game.users.find(e => e.endpointUUID == playerEndpointUUID);
        if (!target) {
            return "Failed to find user";
        }

        target.connectionHandler?.send({
            type: "mute",
            is: is
        });

        target.isMuted = is ?? true;

        return { status: "success" };
    }

    public viewOnly({ playerEndpointUUID, is }: MultiplayerSocketBodyViewOnly) {
        if (!this.game) return "game not found";
        if (!this.user) return "user not found";
        if (!MultiplayerEndpoints.isOwner(this.user.endpointUUID, this.game)) {
            return "You dont have the permissions to do that";
        }
        const target = this.game.users.find(e => e.endpointUUID == playerEndpointUUID);
        if (!target) {
            return "Failed to find user";
        }

        target.connectionHandler?.send({
            type: "viewOnly",
            is: is
        });

        this.game.broadcast({
            type: "deselectAllFlavors",
            endpointUUID: playerEndpointUUID
        }, undefined);

        this.user.selectedFlavors = [];

        target.onlyView = is ?? true;

        return { status: "success" };
    }


    public sendResponse<T>(data: T, reqId: number) {
        this.ws.send(JSON.stringify({
            ...data,
            reqId: reqId == -1 ? undefined : reqId
        }));
    }

    public isViewOnly() {
        return this.user && this.user.onlyView;
    }

    public async messageReceived(rawData: WebSocket.RawData) {
        try {
            const data = JSON.parse(rawData.toString()) as MultiplayerSocketBodyUnknown;
            if (!reqireArgs(data, ["type", "reqId"], this.sendResponse)) return;

            if (data.reqId != null && data.reqId != undefined && data.reqId < 0) {
                this.callbacks[data.reqId as number]?.(data as APIResponse<any>);
                delete this.callbacks[data.reqId as number];
                return;
            }

            let result: {
                status: "error" | "success";
                message?: string;
            } | string | null | undefined = undefined;

            switch (data.type) {
                case "getDish":
                    result = await this.getDish(data) as any;
                    break;
                case "initial":
                    result = await this.onConnectToGame(data) as any;
                    break;
                case "addFlavor":
                    result = await this.addFlavor(data) as any;
                    break;
                case "addSynthLine":
                    result = await this.addSynthLine(data) as any;
                    break;
                case "removeSynthLine":
                    result = await this.removedSynthLine(data) as any;
                    break;
                case "removeFlavors":
                    result = await this.removeFlavors(data) as any;
                    break;
                case "changeVolume":
                    result = await this.changeVolume(data) as any;
                    break;
                case "changeTrackVolume":
                    result = await this.changeTrackVolume(data) as any;
                    break;
                case "selectFlavors":
                    result = await this.selectFlavors(data) as any;
                    break;
                case "selectOnly":
                    result = await this.selectOnly(data) as any;
                    break;
                case "deselectFlavors":
                    result = await this.deselectFlavors(data) as any;
                    break;
                case "deselectAllFlavors":
                    result = await this.deselectAllFlavors(data) as any;
                    break;
                case "updateFlavors":
                    result = await this.updateFlavors(data) as any;
                    break;
                case "rename":
                    result = await this.rename(data) as any;
                    break;
                case "save":
                    result = await this.save(data) as any;
                    break;
                case "message":
                    result = await this.message(data) as any;
                    break;

                case "kick":
                    result = await this.kick(data) as any;
                    break;
                case "mute":
                    result = await this.mute(data) as any;
                    break;
                case "viewOnly":
                    result = await this.viewOnly(data) as any;
                    break;

                default:
                    console.log(data);
            }

            if (result == null || result == undefined) {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    status: "error",
                    message: "Failed to find the function"
                }));
            } else if (typeof result == "string") {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    status: "error",
                    message: result
                }));
            } else if (result.message) {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    status: "error",
                    message: result.message
                }));
            } else {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    ...result
                }));
            }
        } catch (ex) {
            this.ws.send(JSON.stringify({
                status: "error",
                message: "There happened an error"
            }));
            console.error(ex);
        }

    }

    public closedConnection(code: number, reason: Buffer<ArrayBufferLike>) {
        console.log(code);
    }


    public send<T, E, S extends object = {}>(data: T): Promise<APIResponse<E, S>> {
        const reqId = this.currentReqId;
        this.currentReqId--;
        return new Promise<APIResponse<E, S>>((res) => {
            this.ws?.send(JSON.stringify({
                reqId,
                ...data
            }));

            this.callbacks[reqId] = (data: APIResponse<E, S>) => {
                res(data);
            };
        });
    }
}


function reqireArgsReturn<T extends {}>(data: T, requiredOnes: (keyof T)[] | "all"): true | string {
    if (requiredOnes == "all") {
        for (const required of Object.keys(data) as (keyof T)[]) {
            if (data[required] == null || data[required] == undefined) {
                return `${required as string} has to be set`;
            }
        }
        return true;
    }
    for (const required of requiredOnes) {
        if (data[required] == null || data[required] == undefined) {
            return `${required as string} has to be set`;
        }
    }
    return true;
}

function reqireArgs<T extends {}>(data: T, requiredOnes: (keyof T)[] | "all", send?: <E>(data: E, reqId: number) => void, reqId?: number) {
    if (requiredOnes == "all") {
        for (const required of Object.keys(data) as (keyof T)[]) {
            if (data[required] == null || data[required] == undefined) {
                reqId != undefined && send?.({
                    status: "error",
                    message: `${required as string} has to be set`
                }, reqId);
                return false;
            }
        }
        return true;
    }
    for (const required of requiredOnes) {
        if (data[required] == null || data[required] == undefined) {
            reqId != undefined && send?.({
                status: "error",
                message: `${required as string} has to be set`
            }, reqId);
            return false;
        }
    }
    return true;
}

function hasToBeSet<T>(data: T, key: string, send?: <E>(data: E, reqId: number) => void, reqId?: number) {
    if (data == null || data == undefined) {
        reqId != undefined && send?.({
            status: "error",
            message: `${key} has to be set`
        }, reqId);
        return false;
    }
    return true;
}

export namespace Multiplayer {
    export type User = {
        userUUID: UUID | null;
        endpointUUID: UUID;
        connectionHandler: ConnectionHandler | null;
        selectedFlavors: SelectedFlavor[];
        name: string;
        isMuted: boolean;
        onlyView: boolean;
    };

    export type SelectedFlavor = {
        flavorUUID: UUID;
        trackUUID: UUID;
    };

    export type Meeting = {
        users: User[];
        tracks: ServerFlavorSynthLine[];
        mainFlavor: MainFlavor;
        name: string;
        volumes: DishVolumes;
        code: ShareDigits;
        uuid: UUID;
        owner: UUID;
        broadcast: <T>(data: T, skip?: UUID) => boolean;
        senDataTo: <T>(receiverEndpointUUID: UUID, data: T) => boolean
    };
}