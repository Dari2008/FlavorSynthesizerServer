import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DB } from "../@types/db.js";
import { DBConnection } from "./DBConnection.js";
import Users from "./Users.js";
import { UUID } from "node:crypto";

export default class CustomFlavorManager {

    public static PAGE_SIZE = 10;

    public static async getAllPublicFlavors(page: number = 0): Promise<DB.ServerCustomFlavor[]> {
        if (typeof page !== "number") return [];
        const response = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `customFlavors` WHERE `public` = TRUE LIMIT " + CustomFlavorManager.PAGE_SIZE + " OFFSET " + (page * CustomFlavorManager.PAGE_SIZE) + ";");
        if (!response) return [];
        const [rows,] = response;
        const customFlavors: DB.ServerCustomFlavor[] = [];
        for (const row of rows) {
            const username = ((!!row["userUUID"]) ? await Users.getUserName(row["userUUID"]) : undefined) || undefined;
            customFlavors.push({
                audio: row["audio"],
                image: row["image"],
                name: row["name"],
                colors: row["colors"],
                isPublic: row["public"] == 1,
                uuid: row["uuid"],
                creator: username
            });
        }

        return customFlavors;
    }

    public static async getFlavors(userUUID: UUID, flavors: UUID[]) {
        if (flavors.length == 0) return [];

        const username = await Users.getUserName(userUUID);

        let queryString = "";
        const args: {
            [key: string]: UUID;
        } = {};

        console.log(flavors);

        for (let i = 0; i < flavors.length; i++) {
            args["flavors_" + i] = flavors[i];
            queryString += " :flavors_" + i + ",";
        }

        queryString = queryString.substring(1, queryString.length - 1);
        console.log(queryString);

        const response = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `customFlavors` WHERE `userUUID` = :userUUID AND `uuid` IN (" + queryString + ");", {
            userUUID,
            ...args
        });
        if (!response) return [];
        const [rows,] = response;
        const customFlavors: DB.ServerCustomFlavor[] = [];
        for (const row of rows) {
            customFlavors.push({
                audio: row["audio"],
                image: row["image"],
                name: row["name"],
                colors: row["colors"],
                isPublic: row["public"] == 1,
                uuid: row["uuid"],
                creator: username || "Unknown"
            });
        }

        console.log(customFlavors);

        return customFlavors;
    }

    public static async changeVisibility(userUUID: UUID, uuid: UUID, isPublic: boolean) {
        const response = await DBConnection.preparedQuery<ResultSetHeader>("UPDATE `customFlavors` SET `public` = :isPublic WHERE `userUUID`=:userUUID AND `uuid`=:uuid", {
            isPublic,
            userUUID,
            uuid
        });

        if (!response) return false;
        return true;
    }

    public static async getAllFlavors(userUUID: UUID): Promise<DB.ServerCustomFlavor[]> {
        const username = await Users.getUserName(userUUID);
        const response = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `customFlavors` WHERE `userUUID` = :userUUID", {
            userUUID
        });
        if (!response) return [];
        const [rows,] = response;
        const customFlavors: DB.ServerCustomFlavor[] = [];
        for (const row of rows) {
            customFlavors.push({
                audio: row["audio"],
                image: row["image"],
                name: row["name"],
                colors: row["colors"],
                isPublic: row["public"] == 1,
                uuid: row["uuid"],
                creator: username || "Unknown"
            });
        }

        return customFlavors;
    }

    public static async updateCustomFlavor(userUUID: UUID, uuid: UUID, name: string, image: string, audio: string, colors: DB.CustomFlavorColors) {
        const response = await DBConnection.preparedQuery<ResultSetHeader>("UPDATE `customFlavors` SET `name`=:name, `audio`=:audio, `image`=:image, `colors`=:colors WHERE `userUUID`=:userUUID", {
            userUUID,
            uuid,
            name,
            image,
            audio,
            colors: JSON.stringify(colors)
        });

        if (!response) return false;
        return true;
    }

    private static async getAllUUIDs() {
        const all = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT `uuid` FROM `customFlavors`");
        if (!all) return [];
        const uuids = []
        const [rows,] = all;

        for (const row of rows) {
            uuids.push(row["uuid"]);
        }
        return uuids;
    }

    public static async addCustomFlavor(userUUID: UUID, uuid: UUID, name: string, image: string, audio: string, colors: DB.CustomFlavorColors) {
        const usedUUIds = this.getAllUUIDs();

        if ((await usedUUIds).includes(uuid)) {
            return false;
        }

        const response = await DBConnection.preparedQuery<ResultSetHeader>("INSERT INTO `customFlavors` (`userUUID`, `uuid`, `name`, `image`, `audio`, `colors`) VALUES (:userUUID, :uuid, :name, :image, :audio, :colors)", {
            userUUID,
            uuid,
            name,
            image,
            audio,
            colors: JSON.stringify(colors)
        });

        if (!response) return false;
        return true;
    }

    public static async deleteCustomFlavor(userUUID: UUID, uuid: UUID) {
        const response = await DBConnection.preparedQuery<ResultSetHeader>("DELETE FROM `customFlavors` WHERE `userUUID` = :userUUID AND `uuid`=:uuid", {
            userUUID,
            uuid,
        });
        if (!response) return false;
        return true;
    }

}