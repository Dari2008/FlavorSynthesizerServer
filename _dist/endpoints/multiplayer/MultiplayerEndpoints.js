import EndpointUtils from "../utils/EndpointUtils.js";
import { MULTIPLAYER_CREATE_BODY, MULTIPLAYER_JOIN_BODY } from "../../@types/ApiBodyFormats/Users.js";
import Utils, { JWTUtils } from "../../utils/Utils.js";
import { randomInt } from "node:crypto";
import ShareUtils from "../utils/ShareUtils.js";
import { WebSocketServer } from "ws";
import DishManager from "../../sql/DishManager.js";
import Users from "../../sql/Users.js";
export default class MultiplayerEndpoints {
    static CURRENT_RUNNING_MULTIPLAYER = [];
    static getOwner(game) {
        return game.users.find(e => e.endpointUUID == game.owner);
    }
    static isOwner(endpointUUID, game) {
        return game.owner == endpointUUID;
    }
    constructor(app, server) {
        this.init(app, server);
    }
    init(app, server) {
        app.post("/multiplayer/join", async (req, res) => {
            const body = req.body;
            if (!EndpointUtils.checkAndSend(body, MULTIPLAYER_JOIN_BODY, res))
                return;
            const jwt = body.jwt;
            const code = body.code;
            const jwtData = jwt ? JWTUtils.checkJWTAndResponse(jwt, res) : null;
            if (!jwtData && jwt)
                return;
            if (jwtData) {
                const newLoadedName = await Users.getUserName(jwtData.uuid);
                if (typeof newLoadedName == "string")
                    jwtData.username = newLoadedName;
            }
            const name = jwtData?.username ?? body.name;
            const game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => ShareUtils.isShareCodeEqual(e.code, code));
            if (!game) {
                EndpointUtils.sendError(res, "Failed to join meeting", 404);
                return;
            }
            const endpointUUID = Utils.uuidv4Exclude(game.users.map(e => e.endpointUUID));
            const allowConnection = await MultiplayerEndpoints.getOwner(game).connectionHandler?.send({
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
        app.post("/multiplayer/create", async (req, res) => {
            const body = req.body;
            if (!EndpointUtils.checkAndSend(body, MULTIPLAYER_CREATE_BODY, res))
                return;
            if (!body.jwt && !body.dish) {
                EndpointUtils.sendError(res, "Failed to create multiplayer meeting", 405);
                return;
            }
            const jwt = body.jwt;
            const jwtData = jwt ? JWTUtils.checkJWTAndResponse(jwt, res) : null;
            if (!jwtData && jwt)
                return;
            if (jwtData) {
                const newLoadedName = await Users.getUserName(jwtData.uuid);
                if (typeof newLoadedName == "string")
                    jwtData.username = newLoadedName;
            }
            let dish = body.dish ?? null;
            const name = jwtData?.username ?? body.name;
            if (body.dishUUID && jwtData) {
                dish = await DishManager.getDish(jwtData.uuid, body.dishUUID);
            }
            if (!dish) {
                EndpointUtils.sendError(res, "Failed to open dish for multipayer", 404);
                return;
            }
            const endpointUUID = Utils.uuidv4();
            const game = createGame(dish, endpointUUID);
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
    function generateSingleCode() {
        return [
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
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
function createGame(dish, owner) {
    const uuid = generateMeetingUUID();
    const broadcast = (data, skip) => {
        const game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => e.uuid == uuid);
        if (!game)
            return false;
        game.users.filter(e => e.endpointUUID !== skip).forEach(user => {
            if (!user.connectionHandler)
                return;
            user.connectionHandler.sendResponse(data, -1);
        });
        return true;
    };
    const senDataTo = (receiverEndpointUUID, data) => {
        const game = MultiplayerEndpoints.CURRENT_RUNNING_MULTIPLAYER.find(e => e.uuid == uuid);
        if (!game)
            return false;
        game.users.forEach(user => {
            if (!user.connectionHandler)
                return;
            if (user.endpointUUID != receiverEndpointUUID)
                return;
            user.connectionHandler.sendResponse(data, -1);
        });
        return true;
    };
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
    endpointUUID;
    gameUUID;
    game;
    ws;
    user;
    callbacks = {};
    currentReqId = -1;
    constructor(ws) {
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
    close() {
        this.ws.close();
    }
    async onConnectToGame({ endpointUUID, gameUUID }) {
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
    }
    ;
    addFlavor({ flavor, from, to, uuid, trackUUID }) {
        const errors = reqireArgsReturn({ uuid, to, from, flavor }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const track = this.game.tracks.find(e => e.uuid == trackUUID);
        if (!track)
            return "This track doesn't exist";
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
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    addSynthLine({ synthLineUUID }) {
        const errors = reqireArgsReturn({ synthLineUUID }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
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
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    removedSynthLine({ synthLineUUID }) {
        const errors = reqireArgsReturn({ synthLineUUID }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        this.game.tracks = this.game.tracks.filter(e => e.uuid != synthLineUUID);
        const success = this.game?.broadcast({
            type: "removeSynthLine",
            synthLineUUID,
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    removeFlavors({}) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors).map(e => e.flavorUUID);
        const selectedFlavors = this.user.selectedFlavors;
        for (const flavor of selectedFlavors) {
            if (allLockedFlavors.includes(flavor.flavorUUID))
                continue;
            const track = this.game.tracks.find(e => e.uuid == flavor.trackUUID);
            if (!track)
                continue;
            track.elements = track.elements.filter(e => e.uuid !== flavor.flavorUUID);
        }
        const success = this.game?.broadcast({
            type: "removeFlavors",
            selectedFlavors: [...new Set(selectedFlavors)]
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    changeVolume({ newVolume, volumeSlot }) {
        const errors = reqireArgsReturn({ newVolume, volumeSlot }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        this.game.volumes[volumeSlot] = newVolume;
        const success = this.game?.broadcast({
            type: "changeVolume",
            newVolume,
            volumeSlot
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    changeTrackVolume({ newVolume, trackUUID }) {
        const errors = reqireArgsReturn({ newVolume, trackUUID }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const track = this.game.tracks.find(e => e.uuid == trackUUID);
        if (!track)
            return "Couldn't find track";
        track.volume = newVolume;
        const success = this.game?.broadcast({
            type: "changeTrackVolume",
            newVolume,
            trackUUID
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    selectFlavors({ flavorUUIDs }) {
        const errors = reqireArgsReturn({ flavorUUIDs }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors).map(e => e.flavorUUID);
        const selectedByOtherUsers = flavorUUIDs.filter(e => allLockedFlavors.includes(e.flavorUUID));
        flavorUUIDs = flavorUUIDs.filter(e => !allLockedFlavors.includes(e.flavorUUID));
        this.user.selectedFlavors = [...new Set([...this.user.selectedFlavors, ...flavorUUIDs])];
        const success = this.game?.broadcast({
            type: "selectFlavors",
            endpointUUID: this.user.endpointUUID,
            flavorUUIDs
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success", selectedByOtherUsers: selectedByOtherUsers.length == 0 ? undefined : selectedByOtherUsers };
    }
    selectOnly({ flavorUUID }) {
        const errors = reqireArgsReturn({ flavorUUID }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors).map(e => e.flavorUUID);
        if (allLockedFlavors.includes(flavorUUID)) {
            return "Failed to select Flavor";
        }
        const success = this.game?.broadcast({
            type: "selectOnly",
            endpointUUID: this.user.endpointUUID,
            flavorUUID
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    deselectFlavors({ flavorUUIDs }) {
        const errors = reqireArgsReturn({ flavorUUIDs }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        this.user.selectedFlavors = this.user.selectedFlavors.filter(e => !flavorUUIDs.includes(e));
        const success = this.game?.broadcast({
            type: "deselectFlavors",
            endpointUUID: this.user.endpointUUID,
            flavorUUIDs
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    deselectAllFlavors({}) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        this.user.selectedFlavors = [];
        const success = this.game?.broadcast({
            type: "deselectAllFlavors",
            endpointUUID: this.user.endpointUUID
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    updateFlavors({ flavors }) {
        const errors = reqireArgsReturn({ flavors }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const tracks = this.game.tracks;
        const allLockedFlavors = this.game.users.filter(e => e.endpointUUID !== this.user?.endpointUUID).flatMap(e => e.selectedFlavors);
        const originalPositions = {};
        for (const change of flavors) {
            const track = tracks.find(e => e.uuid == change.trackUUID);
            if (!track)
                continue;
            const flavor = track.elements.find(e => e.uuid == change.uuid);
            if (!flavor)
                continue;
            originalPositions[flavor.uuid] = {
                from: flavor.from,
                to: flavor.to
            };
        }
        for (const change of flavors) {
            const track = tracks.find(e => e.uuid == change.trackUUID);
            if (!track)
                continue;
            const flavor = track.elements.find(e => e.uuid == change.uuid);
            if (!flavor)
                continue;
            if (allLockedFlavors.map(e => e.flavorUUID).includes(flavor.uuid))
                continue;
            flavor.from = change.from;
            flavor.to = change.to;
        }
        const intersects = (flavor1, flavor2) => {
            return (flavor1.from >= flavor2.from && flavor1.to <= flavor2.from) || (flavor2.from >= flavor1.from && flavor2.to <= flavor1.from);
        };
        const changedUUIds = flavors.map(e => e.uuid);
        const undoneFlavors = [];
        for (const track of this.game.tracks) {
            const flavors = track.elements;
            for (const flavor1 of flavors) {
                for (const flavor2 of flavors) {
                    if (!intersects(flavor1, flavor2))
                        continue;
                    const changedFlavor = changedUUIds.includes(flavor1.uuid) ? flavor1 : flavor2;
                    const originalPosition = originalPositions[changedFlavor.uuid];
                    if (!originalPosition)
                        continue;
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
        if (!success)
            return "Failed to send broadcast";
        return { status: "success", undoneFlavors: undoneFlavors.length == 0 ? undefined : undoneFlavors };
    }
    rename({ newName }) {
        const errors = reqireArgsReturn({ newName }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        this.game.name = newName;
        const success = this.game?.broadcast({
            type: "rename",
            newName
        }, this.user.endpointUUID);
        if (!success)
            return "Failed to send broadcast";
        return { status: "success" };
    }
    async save({}) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.isViewOnly())
            return "Cant edit";
        const owner = MultiplayerEndpoints.getOwner(this.game);
        if (!owner) {
            return "Couldn't find the owner!";
        }
        owner.connectionHandler?.send({
            type: "save"
        });
        return { status: "success" };
    }
    async message({ message, time, uuid }) {
        const errors = reqireArgsReturn({ message, time }, "all");
        if (errors !== true)
            return errors;
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
        if (this.user.isMuted)
            return "You are Muted";
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
    async getDish({}) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
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
            }
        };
    }
    kick({ playerEndpointUUID }) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
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
    mute({ playerEndpointUUID, is }) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
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
    viewOnly({ playerEndpointUUID, is }) {
        if (!this.game)
            return "game not found";
        if (!this.user)
            return "user not found";
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
    sendResponse(data, reqId) {
        this.ws.send(JSON.stringify({
            ...data,
            reqId: reqId == -1 ? undefined : reqId
        }));
    }
    isViewOnly() {
        return this.user && this.user.onlyView;
    }
    async messageReceived(rawData) {
        try {
            const data = JSON.parse(rawData.toString());
            if (!reqireArgs(data, ["type", "reqId"], this.sendResponse))
                return;
            if (data.reqId != null && data.reqId != undefined && data.reqId < 0) {
                this.callbacks[data.reqId]?.(data);
                delete this.callbacks[data.reqId];
                return;
            }
            let result = undefined;
            switch (data.type) {
                case "getDish":
                    result = await this.getDish(data);
                    break;
                case "initial":
                    result = await this.onConnectToGame(data);
                    break;
                case "addFlavor":
                    result = await this.addFlavor(data);
                    break;
                case "addSynthLine":
                    result = await this.addSynthLine(data);
                    break;
                case "removeSynthLine":
                    result = await this.removedSynthLine(data);
                    break;
                case "removeFlavors":
                    result = await this.removeFlavors(data);
                    break;
                case "changeVolume":
                    result = await this.changeVolume(data);
                    break;
                case "changeTrackVolume":
                    result = await this.changeTrackVolume(data);
                    break;
                case "selectFlavors":
                    result = await this.selectFlavors(data);
                    break;
                case "selectOnly":
                    result = await this.selectOnly(data);
                    break;
                case "deselectFlavors":
                    result = await this.deselectFlavors(data);
                    break;
                case "deselectAllFlavors":
                    result = await this.deselectAllFlavors(data);
                    break;
                case "updateFlavors":
                    result = await this.updateFlavors(data);
                    break;
                case "rename":
                    result = await this.rename(data);
                    break;
                case "save":
                    result = await this.save(data);
                    break;
                case "message":
                    result = await this.message(data);
                    break;
                case "kick":
                    result = await this.kick(data);
                    break;
                case "mute":
                    result = await this.mute(data);
                    break;
                case "viewOnly":
                    result = await this.viewOnly(data);
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
            }
            else if (typeof result == "string") {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    status: "error",
                    message: result
                }));
            }
            else if (result.message) {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    status: "error",
                    message: result.message
                }));
            }
            else {
                this.ws.send(JSON.stringify({
                    reqId: data.reqId,
                    ...result
                }));
            }
        }
        catch (ex) {
            this.ws.send(JSON.stringify({
                status: "error",
                message: "There happened an error"
            }));
            console.error(ex);
        }
    }
    closedConnection(code, reason) {
        console.log(code);
    }
    send(data) {
        const reqId = this.currentReqId;
        this.currentReqId--;
        return new Promise((res) => {
            this.ws?.send(JSON.stringify({
                reqId,
                ...data
            }));
            this.callbacks[reqId] = (data) => {
                res(data);
            };
        });
    }
}
function reqireArgsReturn(data, requiredOnes) {
    if (requiredOnes == "all") {
        for (const required of Object.keys(data)) {
            if (data[required] == null || data[required] == undefined) {
                return `${required} has to be set`;
            }
        }
        return true;
    }
    for (const required of requiredOnes) {
        if (data[required] == null || data[required] == undefined) {
            return `${required} has to be set`;
        }
    }
    return true;
}
function reqireArgs(data, requiredOnes, send, reqId) {
    if (requiredOnes == "all") {
        for (const required of Object.keys(data)) {
            if (data[required] == null || data[required] == undefined) {
                reqId != undefined && send?.({
                    status: "error",
                    message: `${required} has to be set`
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
                message: `${required} has to be set`
            }, reqId);
            return false;
        }
    }
    return true;
}
function hasToBeSet(data, key, send, reqId) {
    if (data == null || data == undefined) {
        reqId != undefined && send?.({
            status: "error",
            message: `${key} has to be set`
        }, reqId);
        return false;
    }
    return true;
}
