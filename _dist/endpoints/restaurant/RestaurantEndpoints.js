import EndpointUtils from "../utils/EndpointUtils.js";
import { RESTAURANT_LOAD_BODY } from "../../@types/ApiBodyFormats/Users.js";
import DishManager from "../../sql/DishManager.js";
export default class RestaurantEndpoints {
    constructor(app) {
        this.init(app);
    }
    init(app) {
        app.post("/restaurant/loadMenu", async (req, res) => {
            const body = req.body;
            if (!EndpointUtils.checkAndSend(body, RESTAURANT_LOAD_BODY, res))
                return;
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
        app.get("/restaurant/getPageCount", async (req, res) => {
            let pageCount = await DishManager.getPageCount();
            if (!pageCount)
                pageCount = 1;
            EndpointUtils.sendOk(res, {
                pages: pageCount
            });
        });
    }
}
