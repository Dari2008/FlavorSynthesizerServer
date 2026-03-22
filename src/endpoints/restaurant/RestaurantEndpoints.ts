import { Express } from "express";
import { APIResponse, LoadRestaurantData, PageCountRestaurantData } from "../../@types/Api.js";
import { RestaurantEndpointLoadBody } from "../../@types/Endpoints.js";
import EndpointUtils from "../utils/EndpointUtils.js";
import { RESTAURANT_LOAD_BODY, USERS_LOGIN_BODY } from "../../@types/ApiBodyFormats/Users.js";
import DishManager from "../../sql/DishManager.js";

export default class RestaurantEndpoints {
    constructor(app: Express) {
        this.init(app);
    }

    private init(app: Express) {
        app.post<string, any, APIResponse<LoadRestaurantData>>("/restaurant/loadMenu", async (req, res) => {

            const body = req.body as RestaurantEndpointLoadBody;
            if (!EndpointUtils.checkAndSend(body, RESTAURANT_LOAD_BODY, res)) return;

            const sortedAfter = body.sortedAfter ?? "none";
            const page = body.page ?? 20;

            const dishes = await DishManager.queryDishes(sortedAfter, page);

            if (!dishes) {
                EndpointUtils.sendError(res, "Failed to load dishes", 500);
                return;
            }

            EndpointUtils.sendOk(res, {
                dishes: dishes
            });

        });

        app.get<string, any, APIResponse<PageCountRestaurantData>>("/restaurant/getPageCount", async (req, res) => {
            let pageCount = await DishManager.getPageCount();

            if (!pageCount) pageCount = 1;

            EndpointUtils.sendOk(res, {
                pages: pageCount
            });
        });
    }
}