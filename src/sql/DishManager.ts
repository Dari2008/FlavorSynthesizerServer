import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DBConnection } from "./DBConnection";
import Utils from "../utils/Utils";
import { DB } from "../@types/db";
import { DishVolumes, ServerDish, ServerFlavorSynthLine, UUID } from "../@types/User";
import { MainFlavor } from "../@types/Flavors";
import { ShareDigits, ShareFlavors } from "../@types/Api";
import Users from "./Users";

export default class DishManager {

    private static PAGE_SIZE = 10;

    public static async generateNewUUID() {
        const uuids = await this.getAllUUIDs();
        if (!uuids) return null;
        return Utils.uuidv4Exclude(uuids);
    }

    public static async getAllUUIDs(): Promise<string[] | null> {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT `uuid` FROM `dishes`");
        if (!result) return null;
        const [rows] = result;
        const uuids = rows.map(e => e["uuid"]);
        return uuids;
    }

    public static async existsDishWithUUID(dishUUID: UUID) {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT count(`uuid`) as cnt FROM `dishes` WHERE `uuid` = :dishUUID", { dishUUID });
        if (!result) return false;
        const [rows] = result;
        return rows[0]["cnt"] > 0;
    }

    public static async getPageCount() {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>(`SELECT count(*) as cnt FROM dishes WHERE \`publishState\` = 'public'`);
        if (!result) return null;
        const [rows] = result;
        if (rows.length != 1) return 1;
        return Math.ceil(rows[0]["cnt"] as number / DishManager.PAGE_SIZE);
    }

    public static async queryDishes(sorted: SortedArg, page: number = 0) {
        let order: string = "";

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

        const result = await DBConnection.preparedQuery<RowDataPacket[]>(`SELECT * FROM dishes WHERE \`publishState\` = 'public' ${order ?? ""} LIMIT :pageSize OFFSET :page`, { page: ((page * DishManager.PAGE_SIZE) + ""), pageSize: (DishManager.PAGE_SIZE + "") });
        if (!result) return null;
        const [rows] = result;

        async function compileDish(row: RowDataPacket) {
            return new Promise<ServerDish>(async (res) => {
                const dishUserId = `${row["userUUID"]}.${row["uuid"]}`
                const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT `AIImage` FROM `shares` WHERE `dish` = :dish", { dish: dishUserId });
                let aiImage = null;
                if (result) {
                    const [rows] = result;
                    if (rows.length == 1) {
                        aiImage = rows[0]["AIImage"] ?? null;
                    }
                }

                res({
                    tracks: row["tracks"] as ServerFlavorSynthLine[],
                    createdAt: row["created_at"],
                    createdBy: row["created_by"] ?? "Unknown",
                    uuid: row["uuid"] as UUID,
                    volumes: row["volumes"] as DishVolumes,
                    name: row["name"],
                    mainFlavor: row["mainFlavor"] as MainFlavor,
                    publishState: row["publishState"] as "public" | "private",
                    share: {
                        aiImage: aiImage,
                        code: undefined,
                        flavors: undefined
                    }
                } as ServerDish);
            });
        }

        const allPromises = [];

        for (const row of rows) {
            allPromises.push(compileDish(row));
        }

        const allResolved = (await Promise.allSettled(allPromises));
        return allResolved.filter(e => e.status == "fulfilled").map(e => e.value);
    }

    public static async getDish(userUUID: UUID, dishUUID: UUID) {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `dishes` WHERE `userUUID` = :userUUID AND `uuid` = :dishUUID;", { userUUID, dishUUID });
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
            tracks: row["tracks"] as ServerFlavorSynthLine[],
            createdAt: row["created_at"],
            createdBy: row["created_by"] ?? "Unknown",
            uuid: row["uuid"] as UUID,
            volumes: row["volumes"] as DishVolumes,
            name: row["name"],
            mainFlavor: row["mainFlavor"] as MainFlavor,
            publishState: row["publishState"] as "public" | "private",
            share: share
        } as ServerDish;
    }

    public static async updateDish(userUUID: UUID, dishUUID: UUID, dish: Pick<ServerDish, "mainFlavor" | "name" | "tracks" | "volumes">): Promise<boolean> {

        const flavorCount = dish.tracks.map(e => e.elements.length).reduce((a, b) => a + b, 0);

        const result = await DBConnection.preparedQuery<ResultSetHeader>("UPDATE `dishes` SET `tracks` = :tracks, `volumes` = :volumes, `name` = :name, `mainFlavor` = :mainFlavor, `flavor_count` = :flavorCount WHERE `userUUID` = :userUUID AND `uuid` = :dishUUID",
            {
                userUUID,
                dishUUID,
                volumes: JSON.stringify(dish.volumes),
                mainFlavor: dish.mainFlavor,
                tracks: JSON.stringify(dish.tracks),
                name: dish.name,
                flavorCount
            });
        if (!result) return false;
        const [res] = result;
        console.log(res.affectedRows, userUUID, dishUUID);
        return res.affectedRows == 1;
    }

    public static async setVisibility(userUUID: UUID, dishUUID: UUID, visibility: DishVisibility) {
        const result = await DBConnection.preparedQuery<ResultSetHeader>("UPDATE `dishes` SET `publishState` = :publishState WHERE `userUUID` = :userUUID AND `uuid` = :dishUUID",
            {
                userUUID,
                dishUUID,
                publishState: visibility
            });
        if (!result) return false;
        const [res] = result;
        return res.affectedRows == 1;
    }

    public static async addDishes(userUUID: UUID, dishes: Pick<ServerDish, "mainFlavor" | "name" | "tracks" | "volumes" | "uuid" | "publishState">[]) {
        const username = await Users.getUserName(userUUID);
        if (!username) return null;

        const uuids = await this.getAllUUIDs();
        const changed: {
            [key: string]: UUID;
        } = {};
        let all: Promise<any>[] = [];

        for (const dish of dishes) {
            let uuid = dish.uuid;
            if (uuids?.includes(uuid)) {
                uuid = Utils.uuidv4Exclude(uuids);
                changed[dish.uuid] = uuid;
                dish.uuid = uuid;
            }

            const flavorCount = dish.tracks.flatMap(e => e.elements).length;
            all.push(DBConnection.preparedQuery<ResultSetHeader>(
                "INSERT INTO `dishes` (`userUUID`, `uuid`, `tracks`, `publishState`, `flavor_count`, `creator`, `volumes`, `name`, `mainFlavor`) VALUES (:userUUID, :dishUUID, :tracks, :publishState, :flavorCount, :creator, :volumes, :name, :mainFlavor)",
                {
                    userUUID,
                    dishUUID: uuid,
                    publishState: dish.publishState ?? "private",
                    tracks: JSON.stringify(dish.tracks),
                    creator: username ?? "Unknown",
                    flavorCount: flavorCount,
                    volumes: JSON.stringify(dish.volumes),
                    name: dish.name,
                    mainFlavor: dish.mainFlavor
                }
            ));

        }

        await Promise.all(all);

        return changed;
    }

    public static async deleteDish(userUUID: UUID, dishUUID: UUID) {
        const result = await DBConnection.preparedQuery<ResultSetHeader>("DELETE FROM `dishes` WHERE `userUUID`=:userUUID AND `uuid` = :dishUUID",
            {
                userUUID,
                dishUUID
            });
        if (!result) return false;
        const [res] = result;
        return res.affectedRows == 1;
    }

    public static async getShareInfoForDish(userUUID: UUID, dishUUID: UUID) {
        const dishSearch = `${userUUID}.${dishUUID}`;
        const shareData = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `shares` WHERE `dish` = :dishSearch",
            {
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

    public static async getDishes(userUUID: UUID) {
        // const username = await users.getUserName(userUUID);


        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `dishes` WHERE `userUUID`=:userUUID",
            {
                userUUID,
            });
        if (!result) return false;
        const [rows] = result;

        const compiled: ServerDish[] = [];
        const promises: Promise<void>[] = [];

        for (let i = 0; i < rows.length; i++) {
            promises.push(new Promise<void>(async (res) => {
                const row = rows[i];
                const share = await this.getShareInfoForDish(userUUID, row["uuid"]);

                const obj = {
                    tracks: row["tracks"] as ServerFlavorSynthLine[],
                    createdAt: row["created_at"],
                    createdBy: row["created_by"] ?? "Unknown",
                    uuid: row["uuid"] as UUID,
                    volumes: row["volumes"] as DishVolumes,
                    name: row["name"],
                    mainFlavor: row["mainFlavor"] as MainFlavor,
                    publishState: row["publishState"] as "public" | "private",
                    share: share
                } as ServerDish;
                compiled.push(obj);
                res();
            }))
        }

        await Promise.all(promises);

        return compiled;
    }

    public static async updateEntireDish(userUUID: UUID, dishUUID: UUID, tracks: ServerFlavorSynthLine[], mainFlavor: MainFlavor, name: string, volumes: DishVolumes) {
        const flavorCount = tracks.map(e => e.elements.length).reduce((a, b) => a + b, 0);

        const username = await Users.getUserName(userUUID);
        if (!username) {
            console.log("Name not found");
            return false;
        }

        const result = await DBConnection.preparedQuery<ResultSetHeader>("INSERT INTO `dishes` (`userUUID`, `uuid`, `tracks`, `volumes`, `name`, `mainFlavor`, `flavor_count`, `publishState`, `creator`) VALUES (:userUUID, :dishUUID, :tracks, :volumes, :name, :mainFlavor, :flavorCount, 'private', :username) ON DUPLICATE KEY UPDATE `tracks` = VALUES(`tracks`), `volumes` = VALUES(`volumes`), `name` = VALUES(`name`), `mainFlavor` = VALUES(`mainFlavor`), `flavor_count` = VALUES(`flavor_count`);",
            {
                userUUID,
                dishUUID,
                volumes: JSON.stringify(volumes),
                mainFlavor: mainFlavor,
                tracks: JSON.stringify(tracks),
                name: name,
                flavorCount,
                username
            });
        if (!result) return false;
        const [res] = result;
        console.log(res.affectedRows);
        return res.affectedRows == 1;
    }


    // public async isValidUser(userUUID: UUID): Promise<boolean> {
    //     const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM `users` WHERE `uuid` = :userUUID", { userUUID });
    //     if (!result) return true;
    //     const [rows] = result;
    //     return rows[0]["cnt"] > 0;
    // }
}

export type SortedArg = "oldest" | "newest" | "flavorCount" | "none";
export type DishVisibility = "public" | "private";