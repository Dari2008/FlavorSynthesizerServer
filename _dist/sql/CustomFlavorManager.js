import { DBConnection } from "./DBConnection.js";
import Users from "./Users.js";
export default class CustomFlavorManager {
    static async getAllPublicFlavors() {
        const response = await DBConnection.preparedQuery("SELECT * FROM `customFlavors` WHERE `public` = TRUE");
        if (!response)
            return [];
        const [rows,] = response;
        const customFlavors = [];
        for (const row of rows) {
            const username = ((!!row["userUUID"]) ? await Users.getUserName(row["userUUID"]) : undefined) || undefined;
            customFlavors.push({
                audio: row["audio"],
                image: row["image"],
                name: row["name"],
                colors: row["colors"],
                isPublic: row["isPublic"],
                uuid: row["uuid"],
                creator: username
            });
        }
        return customFlavors;
    }
    static async changeVisibility(userUUID, uuid, isPublic) {
        const response = await DBConnection.preparedQuery("UPDATE `customFlavors` SET `public` = :isPublic WHERE `userUUID`=:userUUID AND `uuid`=:uuid", {
            isPublic,
            userUUID,
            uuid
        });
        if (!response)
            return false;
        return true;
    }
    static async getAllFlavors(userUUID) {
        const username = await Users.getUserName(userUUID);
        const response = await DBConnection.preparedQuery("SELECT * FROM `customFlavors` WHERE `userUUID` = :userUUID", {
            userUUID
        });
        if (!response)
            return [];
        const [rows,] = response;
        const customFlavors = [];
        for (const row of rows) {
            customFlavors.push({
                audio: row["audio"],
                image: row["image"],
                name: row["name"],
                colors: row["colors"],
                isPublic: row["isPublic"],
                uuid: row["uuid"],
                creator: username || "Unknown"
            });
        }
        return customFlavors;
    }
    static async updateCustomFlavor(userUUID, uuid, name, image, audio, colors) {
        const response = await DBConnection.preparedQuery("UPDATE `customFlavors` SET `name`=:name, `audio`=:audio, `image`=:image, `colors`=:colors WHERE `userUUID`=:userUUID", {
            userUUID,
            uuid,
            name,
            image,
            audio,
            colors: JSON.stringify(colors)
        });
        if (!response)
            return false;
        return true;
    }
    static async getAllUUIDs() {
        const all = await DBConnection.preparedQuery("SELECT `uuid` FROM `customFlavors`");
        if (!all)
            return [];
        const uuids = [];
        const [rows,] = all;
        for (const row of rows) {
            uuids.push(row["uuid"]);
        }
        return uuids;
    }
    static async addCustomFlavor(userUUID, uuid, name, image, audio, colors) {
        const usedUUIds = this.getAllUUIDs();
        if ((await usedUUIds).includes(uuid)) {
            return false;
        }
        const response = await DBConnection.preparedQuery("INSERT INTO `customFlavors` (`userUUID`, `uuid`, `name`, `image`, `audio`, `colors`) VALUES (:userUUID, :uuid, :name, :image, :audio, :colors)", {
            userUUID,
            uuid,
            name,
            image,
            audio,
            colors: JSON.stringify(colors)
        });
        if (!response)
            return false;
        return true;
    }
    static async deleteCustomFlavor(userUUID, uuid) {
        const response = await DBConnection.preparedQuery("DELETE FROM `customFlavors` WHERE `userUUID` = :userUUID AND `uuid`=:uuid", {
            userUUID,
            uuid,
        });
        if (!response)
            return false;
        return true;
    }
}
