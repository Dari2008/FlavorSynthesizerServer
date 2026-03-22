import { DBConnection } from "./DBConnection.js";
import Utils from "../utils/Utils.js";
import Users from "./Users.js";
export default class DishManager {
    static PAGE_SIZE = 10;
    static async generateNewUUID() {
        const uuids = await this.getAllUUIDs();
        if (!uuids)
            return null;
        return Utils.uuidv4Exclude(uuids);
    }
    static async getAllUUIDs() {
        const result = await DBConnection.preparedQuery("SELECT `uuid` FROM `dishes`");
        if (!result)
            return null;
        const [rows] = result;
        const uuids = rows.map(e => e["uuid"]);
        return uuids;
    }
    static async existsDishWithUUID(dishUUID) {
        const result = await DBConnection.preparedQuery("SELECT count(`uuid`) as cnt FROM `dishes` WHERE `uuid` = :dishUUID", { dishUUID });
        if (!result)
            return false;
        const [rows] = result;
        return rows[0]["cnt"] > 0;
    }
    static async getPageCount() {
        const result = await DBConnection.preparedQuery(`SELECT count(*) as cnt FROM dishes WHERE \`publishState\` = 'public'`);
        if (!result)
            return null;
        const [rows] = result;
        if (rows.length != 1)
            return 1;
        return Math.ceil(rows[0]["cnt"] / DishManager.PAGE_SIZE);
    }
    static async queryDishes(sorted, page = 0) {
        let order = "";
        switch (sorted) {
            case "oldest":
                order = "ORDER BY `created_at` ASC";
                break;
            case "newest":
                order = "ORDER BY `created_at` DESC";
                break;
            case "flavorCount":
                order = "ORDER BY `flavor_count` DESC";
                break;
        }
        const result = await DBConnection.preparedQuery(`SELECT * FROM dishes WHERE \`publishState\` = 'public' ${order ?? ""} LIMIT :pageSize OFFSET :page`, { page: ((page * DishManager.PAGE_SIZE) + ""), pageSize: (DishManager.PAGE_SIZE + "") });
        if (!result)
            return null;
        const [rows] = result;
        async function compileDish(row) {
            return new Promise(async (res) => {
                const dishUserId = `${row["userUUID"]}.${row["uuid"]}`;
                const result = await DBConnection.preparedQuery("SELECT `AIImage` FROM `shares` WHERE `dish` = :dish", { dish: dishUserId });
                let aiImage = null;
                if (result) {
                    const [rows] = result;
                    if (rows.length == 1) {
                        aiImage = rows[0]["AIImage"] ?? null;
                    }
                }
                res({
                    tracks: row["tracks"],
                    createdAt: row["created_at"],
                    createdBy: row["created_by"] ?? "Unknown",
                    uuid: row["uuid"],
                    volumes: row["volumes"],
                    name: row["name"],
                    mainFlavor: row["mainFlavor"],
                    publishState: row["publishState"],
                    share: {
                        aiImage: aiImage,
                        code: undefined,
                        flavors: undefined
                    }
                });
            });
        }
        const allPromises = [];
        for (const row of rows) {
            allPromises.push(compileDish(row));
        }
        const allResolved = (await Promise.allSettled(allPromises));
        return allResolved.filter(e => e.status == "fulfilled").map(e => e.value);
    }
    static async getDish(userUUID, dishUUID) {
        const result = await DBConnection.preparedQuery("SELECT * FROM `dishes` WHERE `userUUID` = :userUUID AND `uuid` = :dishUUID;", { userUUID, dishUUID });
        if (!result) {
            return null;
        }
        const [rows] = result;
        if (rows.length != 1) {
            return null;
        }
        const row = rows[0];
        const share = await this.getShareInfoForDish(userUUID, row["uuid"]);
        return {
            tracks: row["tracks"],
            createdAt: row["created_at"],
            createdBy: row["created_by"] ?? "Unknown",
            uuid: row["uuid"],
            volumes: row["volumes"],
            name: row["name"],
            mainFlavor: row["mainFlavor"],
            publishState: row["publishState"],
            share: share
        };
    }
    static async updateDish(userUUID, dishUUID, dish) {
        const flavorCount = dish.tracks.map(e => e.elements.length).reduce((a, b) => a + b, 0);
        const result = await DBConnection.preparedQuery("UPDATE `dishes` SET `tracks` = :tracks, `volumes` = :volumes, `name` = :name, `mainFlavor` = :mainFlavor, `flavor_count` = :flavorCount WHERE `userUUID` = :userUUID AND `uuid` = :dishUUID", {
            userUUID,
            dishUUID,
            volumes: JSON.stringify(dish.volumes),
            mainFlavor: dish.mainFlavor,
            tracks: JSON.stringify(dish.tracks),
            name: dish.name,
            flavorCount
        });
        if (!result)
            return false;
        return true;
    }
    static async setVisibility(userUUID, dishUUID, visibility) {
        const result = await DBConnection.preparedQuery("UPDATE `dishes` SET `publishState` = :publishState WHERE `userUUID` = :userUUID AND `uuid` = :dishUUID", {
            userUUID,
            dishUUID,
            publishState: visibility
        });
        if (!result)
            return false;
        const [res] = result;
        return true;
    }
    static async addDishes(userUUID, dishes) {
        const username = await Users.getUserName(userUUID);
        if (!username)
            return null;
        const uuids = await this.getAllUUIDs();
        const changed = {};
        let all = [];
        for (const dish of dishes) {
            let uuid = dish.uuid;
            if (uuids?.includes(uuid)) {
                uuid = Utils.uuidv4Exclude(uuids);
                changed[dish.uuid] = uuid;
                dish.uuid = uuid;
            }
            const flavorCount = dish.tracks.flatMap(e => e.elements).length;
            all.push(DBConnection.preparedQuery("INSERT INTO `dishes` (`userUUID`, `uuid`, `tracks`, `publishState`, `flavor_count`, `creator`, `volumes`, `name`, `mainFlavor`) VALUES (:userUUID, :dishUUID, :tracks, :publishState, :flavorCount, :creator, :volumes, :name, :mainFlavor)", {
                userUUID,
                dishUUID: uuid,
                publishState: dish.publishState ?? "private",
                tracks: JSON.stringify(dish.tracks),
                creator: username ?? "Unknown",
                flavorCount: flavorCount,
                volumes: JSON.stringify(dish.volumes),
                name: dish.name,
                mainFlavor: dish.mainFlavor
            }));
        }
        await Promise.all(all);
        return changed;
    }
    static async deleteDish(userUUID, dishUUID) {
        const result = await DBConnection.preparedQuery("DELETE FROM `dishes` WHERE `userUUID`=:userUUID AND `uuid` = :dishUUID", {
            userUUID,
            dishUUID
        });
        if (!result)
            return false;
        const [res] = result;
        return true;
    }
    static async getShareInfoForDish(userUUID, dishUUID) {
        const dishSearch = `${userUUID}.${dishUUID}`;
        const shareData = await DBConnection.preparedQuery("SELECT * FROM `shares` WHERE `dish` = :dishSearch", {
            dishSearch,
        });
        let code = undefined;
        let flavors = undefined;
        let aiImage = undefined;
        if (shareData) {
            const [rows] = shareData;
            if (rows.length == 1) {
                const row = rows[0];
                code = row["code"];
                flavors = row["flavors"];
                aiImage = row["AIImage"];
                return {
                    aiImage: aiImage,
                    code: code,
                    flavors: flavors
                };
            }
        }
        return undefined;
    }
    static async getDishes(userUUID) {
        // const username = await users.getUserName(userUUID);
        const result = await DBConnection.preparedQuery("SELECT * FROM `dishes` WHERE `userUUID`=:userUUID", {
            userUUID,
        });
        if (!result)
            return false;
        const [rows] = result;
        const compiled = [];
        const promises = [];
        for (let i = 0; i < rows.length; i++) {
            promises.push(new Promise(async (res) => {
                const row = rows[i];
                const share = await this.getShareInfoForDish(userUUID, row["uuid"]);
                const obj = {
                    tracks: row["tracks"],
                    createdAt: row["created_at"],
                    createdBy: row["created_by"] ?? "Unknown",
                    uuid: row["uuid"],
                    volumes: row["volumes"],
                    name: row["name"],
                    mainFlavor: row["mainFlavor"],
                    publishState: row["publishState"],
                    share: share
                };
                compiled.push(obj);
                res();
            }));
        }
        await Promise.all(promises);
        return compiled;
    }
    static async updateEntireDish(userUUID, dishUUID, tracks, mainFlavor, name, volumes) {
        const flavorCount = tracks.map(e => e.elements.length).reduce((a, b) => a + b, 0);
        console.log(userUUID, dishUUID, tracks, mainFlavor, name, volumes);
        const username = await Users.getUserName(userUUID);
        if (!username) {
            console.log("Name not found");
            return false;
        }
        const result = await DBConnection.preparedQuery("INSERT INTO `dishes` (`userUUID`, `uuid`, `tracks`, `volumes`, `name`, `mainFlavor`, `flavor_count`, `publishState`, `creator`) VALUES (:userUUID, :dishUUID, :tracks, :volumes, :name, :mainFlavor, :flavorCount, 'private', :username) ON DUPLICATE KEY UPDATE `tracks` = VALUES(`tracks`), `volumes` = VALUES(`volumes`), `name` = VALUES(`name`), `mainFlavor` = VALUES(`mainFlavor`), `flavor_count` = VALUES(`flavor_count`);", {
            userUUID,
            dishUUID,
            volumes: JSON.stringify(volumes),
            mainFlavor: mainFlavor,
            tracks: JSON.stringify(tracks),
            name: name,
            flavorCount,
            username
        });
        if (!result)
            return false;
        return true;
    }
}
