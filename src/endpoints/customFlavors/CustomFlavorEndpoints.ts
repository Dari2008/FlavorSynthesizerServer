import { Express } from "express";
import EndpointUtils from "../utils/EndpointUtils";
import { CustomFlavorAddBody, CustomFlavorDeleteBody, CustomFlavorGetAllBody, CustomFlavorGetPublicBody, CustomFlavorUpdateVisibilityBody } from "../../@types/Endpoints";
import { CUSTOM_FLAVORS_ADD, CUSTOM_FLAVORS_GET_ALL, CUSTOM_FLAVORS_GET_PUBLIC, CUSTOM_FLAVORS_REMOVE, CUSTOM_FLAVORS_UPDATE_VISIBILITY } from "../../@types/ApiBodyFormats/Users";
import CustomFlavorManager from "../../sql/CustomFlavorManager";
import { JWTUtils } from "../../utils/Utils";

export default class CustomFlavorEndpoints {
    constructor(app: Express) {
        this.init(app);
    }

    private init(app: Express) {
        app.post("/customFlavors/getPublicFlavors", async (req, res) => {
            const body = req.body as CustomFlavorGetPublicBody;
            if (!EndpointUtils.checkAndSend(body, CUSTOM_FLAVORS_GET_PUBLIC, res)) return;

            const flavors = await CustomFlavorManager.getAllPublicFlavors();

            EndpointUtils.sendOk(res, {
                customFlavors: flavors
            });
        });

        app.post("/customFlavors/add", async (req, res) => {
            const body = req.body as CustomFlavorAddBody;
            if (!EndpointUtils.checkAndSend(body, CUSTOM_FLAVORS_ADD, res)) return;

            const jwt = body.jwt!;
            const jwtData = JWTUtils.checkJWTAndResponse(jwt, res);
            if (!jwtData) return;

            const userUUID = jwtData.uuid;
            const uuid = body.uuid;
            const name = body.name;
            const image = body.image;
            const audio = body.audio;
            const colors = body.colors;

            const success = await CustomFlavorManager.addCustomFlavor(userUUID, uuid, name, image, audio, colors);

            if (success) {
                EndpointUtils.sendOk(res);
            } else {
                EndpointUtils.sendError(res, "Failed to add custom flavor", 500);
            }

        });

        app.post("/customFlavors/delete", async (req, res) => {
            const body = req.body as CustomFlavorDeleteBody;
            if (!EndpointUtils.checkAndSend(body, CUSTOM_FLAVORS_REMOVE, res)) return;


            const jwt = body.jwt!;
            const jwtData = JWTUtils.checkJWTAndResponse(jwt, res);
            if (!jwtData) return;

            const userUUID = jwtData.uuid;
            const uuid = body.uuid;

            const success = await CustomFlavorManager.deleteCustomFlavor(userUUID, uuid);

            if (success) {
                EndpointUtils.sendOk(res);
            } else {
                EndpointUtils.sendError(res, "Failed to delete custom flavor", 500);
            }
        });

        app.post("/customFlavors/getAll", async (req, res) => {
            const body = req.body as CustomFlavorGetAllBody;
            if (!EndpointUtils.checkAndSend(body, CUSTOM_FLAVORS_GET_ALL, res)) return;

            const jwt = body.jwt!;
            const jwtData = JWTUtils.checkJWTAndResponse(jwt, res);
            if (!jwtData) return;

            const userUUID = jwtData.uuid;
            const localFlavors = body.localFlavors;

            if (localFlavors && localFlavors.length > 0) {
                for (const flavor of localFlavors) {
                    await CustomFlavorManager.addCustomFlavor(userUUID, flavor.uuid, flavor.name, flavor.image, flavor.audio, flavor.colors);
                }
            }


            const flavors = await CustomFlavorManager.getAllFlavors(userUUID);

            EndpointUtils.sendOk(res, {
                customFlavors: flavors
            });

        });

        app.post("/customFlavors/updateVisibility", async (req, res) => {
            const body = req.body as CustomFlavorUpdateVisibilityBody;
            if (!EndpointUtils.checkAndSend(body, CUSTOM_FLAVORS_UPDATE_VISIBILITY, res)) return;

            const jwt = body.jwt!;
            const jwtData = JWTUtils.checkJWTAndResponse(jwt, res);
            if (!jwtData) return;

            const userUUID = jwtData.uuid;
            const uuid = body.uuid;
            const is = body.is;

            const success = await CustomFlavorManager.changeVisibility(userUUID, uuid, is);

            if (success) {
                EndpointUtils.sendOk(res);
            } else {
                EndpointUtils.sendError(res, "Failed to change visibility", 500);
            }
        });

        app.post("/customFlavors/update", async (req, res) => {
            const body = req.body as CustomFlavorAddBody;
            if (!EndpointUtils.checkAndSend(body, CUSTOM_FLAVORS_ADD, res)) return;

            const jwt = body.jwt!;
            const jwtData = JWTUtils.checkJWTAndResponse(jwt, res);
            if (!jwtData) return;

            const userUUID = jwtData.uuid;
            const uuid = body.uuid;
            const name = body.name;
            const image = body.image;
            const audio = body.audio;
            const colors = body.colors;

            const success = await CustomFlavorManager.updateCustomFlavor(userUUID, uuid, name, image, audio, colors);

            if (success) {
                EndpointUtils.sendOk(res);
            } else {
                EndpointUtils.sendError(res, "Failed to update custom flavor", 500);
            }

        });

        // app.post("/customFlavors/")

    }
}