import { Express } from "express";
import { DishesEndpointLoadDishesBody } from "../../@types/Endpoints";
import EndpointUtils from "../utils/EndpointUtils";
import { DISHES_LOAD_BODY } from "../../@types/ApiBodyFormats/Users";
import { JWTUtils } from "../../utils/Utils";
import Users from "../../sql/Users";
import { APIResponse, DishLoadResponse } from "../../@types/Api";
import DishManager from "../../sql/DishManager";

export default class DishesEndpoints {
    constructor(app: Express) {
        this.init(app);
    }

    private init(app: Express) {

        const users = new Users();
        const dishesManager = new DishManager();

        app.post<string, any, APIResponse<DishLoadResponse>>("/dishes/loadDishes", async (req, res) => {

            const body = req.body as DishesEndpointLoadDishesBody;
            if (!EndpointUtils.checkAndSend(body, DISHES_LOAD_BODY, res)) return;

            const jwt = JWTUtils.checkJWTAndResponse(body.jwt!, res);
            if (!jwt) return;

            const userUUID = jwt.uuid;

            if (!await users.isValidUser(userUUID)) {
                EndpointUtils.sendError(res, "Invalid user (0x005)", 401, {
                    logout: true
                });
                return;
            }

            const dishes = await dishesManager.getDishes(userUUID, users);

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
    }
}