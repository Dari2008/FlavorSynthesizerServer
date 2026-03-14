import { Express } from "express";
import { DishesEndpointAddDishBody, DishesEndpointDeleteDishBody, DishesEndpointLoadDishesBody, DishesEndpointUpdateDishBody } from "../../@types/Endpoints";
import EndpointUtils from "../utils/EndpointUtils";
import { ADD_DISH_BODY, DELETE_DISH_BODY, DISHES_LOAD_BODY, UPDATE_DISH_BODY } from "../../@types/ApiBodyFormats/Users";
import { JWTUtils } from "../../utils/Utils";
import Users from "../../sql/Users";
import { AddDishResponse, APIResponse, DishLoadResponse } from "../../@types/Api";
import DishManager from "../../sql/DishManager";
import { UUID } from "../../@types/User";

export default class DishesEndpoints {
    constructor(app: Express) {
        this.init(app);
    }

    private init(app: Express) {
        app.post<string, any, APIResponse<DishLoadResponse>>("/dishes/loadDishes", async (req, res) => {

            const body = req.body as DishesEndpointLoadDishesBody;
            if (!EndpointUtils.checkAndSend(body, DISHES_LOAD_BODY, res)) return;

            const jwt = JWTUtils.checkJWTAndResponse(body.jwt!, res);
            if (!jwt) return;

            const userUUID = jwt.uuid;

            if (!await Users.isValidUser(userUUID)) {
                EndpointUtils.sendError(res, "Invalid user (0x005)", 401, {
                    logout: true
                });
                return;
            }

            const dishes = await DishManager.getDishes(userUUID);

            if (dishes === false) {
                EndpointUtils.sendError(res, "Failed to load dishes (0x006)", 500);
                return;
            }

            res.status(200);
            res.send({
                status: "success",
                dishes: dishes
            });

        });

        app.post<string, any, APIResponse<{}>>("/dishes/update/updateDish", async (req, res) => {
            const body = req.body as DishesEndpointUpdateDishBody;
            if (!EndpointUtils.checkAndSend(body, UPDATE_DISH_BODY, res)) return;

            const jwt = JWTUtils.checkJWTAndResponse(body.jwt!, res);
            if (!jwt) return;

            const userUUID = jwt.uuid;

            if (!await Users.isValidUser(userUUID)) {
                EndpointUtils.sendError(res, "Invalid user (0x005)", 401, {
                    logout: true
                });
                return;
            }

            const mainFlavor = body.mainFlavor!;
            const tracks = body.tracks!;
            const volumes = body.volumes!;
            const name = body.name!;
            const dishUUID = body.uuid!;

            // const existsDish = await DishManager.existsDishWithUUID(dishUUID);
            // let changedUUIDs: {
            //     [key: string]: UUID;
            // } = {};

            // if (!existsDish) {
            //     const result = await DishManager.addDishes(userUUID, [{
            //         mainFlavor,
            //         name,
            //         publishState: "private",
            //         tracks,
            //         uuid: dishUUID,
            //         volumes
            //     }]);
            //     if (!result) {
            //         EndpointUtils.sendError(res, "Failed to add dish", 500);
            //         return;
            //     }
            //     changedUUIDs = result;
            // }

            const success = await DishManager.updateEntireDish(userUUID, dishUUID, tracks, mainFlavor, name, volumes);

            if (success) {
                EndpointUtils.sendOk(res);
            } else {
                EndpointUtils.sendError(res, "Failed to update dish", 500);
            }

        });

        app.post<string, any, APIResponse<AddDishResponse>>("/dishes/update/addDish", async (req, res) => {
            const body = req.body as DishesEndpointAddDishBody;
            if (!EndpointUtils.checkAndSend(body, ADD_DISH_BODY, res)) return;

            const jwt = JWTUtils.checkJWTAndResponse(body.jwt!, res);
            if (!jwt) return;

            const userUUID = jwt.uuid;

            if (!await Users.isValidUser(userUUID)) {
                EndpointUtils.sendError(res, "Invalid user (0x005)", 401, {
                    logout: true
                });
                return;
            }

            const mainFlavor = body.mainFlavor!;
            const tracks = body.tracks!;
            const volumes = body.volumes!;
            const name = body.name!;
            const dishUUID = body.uuid!;

            const changedUUIDs = await DishManager.addDishes(userUUID, [{
                mainFlavor,
                name,
                tracks,
                volumes,
                publishState: "private",
                uuid: dishUUID
            }]);

            if (changedUUIDs) {
                EndpointUtils.sendOk(res, {
                    changedUUIDs
                });
            } else {
                EndpointUtils.sendError(res, "Failed to add dish", 500);
            }

        });

        app.post<string, any, APIResponse<{}>>("/dishes/update/delete", async (req, res) => {
            const body = req.body as DishesEndpointDeleteDishBody;
            if (!EndpointUtils.checkAndSend(body, DELETE_DISH_BODY, res)) return;

            const jwt = JWTUtils.checkJWTAndResponse(body.jwt!, res);
            if (!jwt) return;

            const userUUID = jwt.uuid;

            if (!await Users.isValidUser(userUUID)) {
                EndpointUtils.sendError(res, "Invalid user (0x005)", 401, {
                    logout: true
                });
                return;
            }

            const dishUUID = body.uuid!;
            const success = await DishManager.deleteDish(userUUID, dishUUID);

            if (success) {
                EndpointUtils.sendOk(res);
            } else {
                EndpointUtils.sendError(res, "Failed to delete dish", 500);
            }

        });
    }
}