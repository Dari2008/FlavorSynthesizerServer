import { Express } from "express";
import { APIResponse, LoadRestaurantData } from "../../@types/Api";
import { RestaurantEndpointLoadBody } from "../../@types/Endpoints";
import EndpointUtils from "../utils/EndpointUtils";
import { RESTAURANT_LOAD_BODY, USERS_LOGIN_BODY } from "../../@types/ApiBodyFormats/Users";
import DishManager from "../../sql/DishManager";

export default class RestaurantEndpoints {
    constructor(app: Express) {
        this.init(app);
    }

    private init(app: Express) {
        app.post<APIResponse<LoadRestaurantData>>("/restaurant/loadDishes", async (req, res) => {

            const body = req.body as RestaurantEndpointLoadBody;
            if (!EndpointUtils.checkAndSend(body, RESTAURANT_LOAD_BODY, res)) return;

            const sortedAfter = body.sortedAfter ?? "none";
            const limit = body.limit ?? 20;

            const dishes = await DishManager.queryDishes(sortedAfter, limit);

            EndpointUtils.sendOk(res, {
                dishes: dishes
            });

        });
    }
}