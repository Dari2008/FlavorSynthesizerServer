import EndpointUtils from "../utils/EndpointUtils.js";
import { OPEN_SHARE_BODY, SET_DISH_STATE_BODY, SHARE_BODY } from "../../@types/ApiBodyFormats/Users.js";
import ShareManager from "../../sql/ShareManager.js";
import { JWTUtils } from "../../utils/Utils.js";
import DishManager from "../../sql/DishManager.js";
export default class ShareEndpoints {
    constructor(app) {
        this.init(app);
    }
    init(app) {
        app.post("/share/share", async (req, res) => {
            const body = req.body;
            if (!EndpointUtils.checkAndSend(body, SHARE_BODY, res))
                return;
            const flavors = body.flavors;
            const dish = body.dish;
            const jwt = body.jwt;
            const existsFlavorCombo = await ShareManager.existsFlavorCombo(flavors);
            if (existsFlavorCombo) {
                EndpointUtils.sendError(res, "The flavor combo already exists", 405, {
                    flavorComboExists: true,
                });
                return;
            }
            let jwtData = !!jwt ? JWTUtils.getData(jwt) : -1;
            if (!jwtData) {
                EndpointUtils.sendError(res, "Expired login credentials", 401, {
                    logout: true,
                    flavorComboExists: false
                });
                return;
            }
            if (jwtData == -1)
                jwtData = null;
            let userUUID = jwtData?.uuid;
            let changedUUID = undefined;
            if (userUUID && (!dish.uuid || !(await DishManager.existsDishWithUUID(dish.uuid)))) {
                const newUUID = await DishManager.generateNewUUID();
                if (!newUUID) {
                    EndpointUtils.sendError(res, "Failed to gen new UUID", 500);
                    return;
                }
                dish.uuid = newUUID;
                changedUUID = newUUID;
                await DishManager.addDishes(userUUID, [dish]);
            }
            console.log(changedUUID);
            const result = await ShareManager.share(userUUID ?? null, flavors, dish);
            if (result) {
                EndpointUtils.sendOk(res, {
                    changedUUID: changedUUID,
                    dishData: result
                });
            }
            else {
                EndpointUtils.sendError(res, "Failed to share your dish", 500);
            }
        });
        app.post("/share/setDishState", async (req, res) => {
            const body = req.body;
            if (!EndpointUtils.checkAndSend(body, SET_DISH_STATE_BODY, res))
                return;
            const jwt = JWTUtils.getData(body.jwt);
            const dishUUID = body.dishUUID;
            const visibility = body.visibility;
            if (!jwt) {
                EndpointUtils.sendError(res, "Credentials Expired", 401, {
                    logout: true
                });
                return;
            }
            const userUUID = jwt.uuid;
            const success = await DishManager.setVisibility(userUUID, dishUUID, visibility);
            if (success) {
                EndpointUtils.sendOk(res);
            }
            else {
                EndpointUtils.sendError(res, "Failed to update visibility", 500);
            }
        });
        app.post("/share/open", async (req, res) => {
            const body = req.body;
            if (!EndpointUtils.checkAndSend(body, OPEN_SHARE_BODY, res))
                return;
            const type = body.type;
            let dish = null;
            switch (type) {
                case "code":
                    if (!body.code) {
                        EndpointUtils.sendError(res, "code has to be set when type='code'", 404);
                        return;
                    }
                    dish = await ShareManager.getDishByCode(body.code);
                    break;
                case "flavors":
                    if (!body.flavors) {
                        EndpointUtils.sendError(res, "flavors has to be set when type='flavors'", 404);
                        return;
                    }
                    dish = await ShareManager.getDishByFlavors(body.flavors);
                    break;
                case "aiImage":
                    if (!body.aiImage) {
                        EndpointUtils.sendError(res, "aiImage has to be set when type='aiImage'", 404);
                        return;
                    }
                    dish = await ShareManager.getDishByAIImage(body.aiImage);
                    break;
            }
            if (dish) {
                EndpointUtils.sendOk(res, {
                    dish: dish
                });
            }
            else {
                EndpointUtils.sendError(res, "Dish not found", 404);
            }
        });
    }
}
