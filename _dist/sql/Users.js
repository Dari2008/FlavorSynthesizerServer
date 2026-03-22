import { DBConnection } from "./DBConnection.js";
import argon2 from "argon2";
import Utils from "../utils/Utils.js";
export default class Users {
    static async isValidUser(userUUID) {
        const result = await DBConnection.preparedQuery("SELECT COUNT(*) AS cnt FROM `users` WHERE `uuid` = :userUUID", { userUUID });
        if (!result)
            return true;
        const [rows] = result;
        return rows[0]["cnt"] > 0;
    }
    static async usernameExists(username) {
        const result = await DBConnection.preparedQuery("SELECT COUNT(*) AS cnt FROM `users` WHERE `username` = :username", { username });
        if (!result)
            return true;
        const [rows] = result;
        return rows[0]["cnt"] > 0;
    }
    static async createUser(username, password, email) {
        const uuid = await this.generateUUID();
        const hashedPassword = await argon2.hash(password, {
            type: argon2.argon2i
        });
        if (!uuid)
            return false;
        if (!hashedPassword)
            return false;
        const result = await DBConnection.preparedQuery("INSERT INTO `users` (`uuid`, `email`, `password`, `username`) VALUES (:uuid, :email, :password, :username)", {
            username,
            email,
            password: hashedPassword,
            uuid: uuid
        });
        if (!result)
            return false;
        return result[0].affectedRows == 1;
    }
    static async getUser(username) {
        const result = await DBConnection.preparedQuery("SELECT * FROM `users` WHERE `username`= :username OR `email`=:username", { username });
        if (!result)
            return null;
        const [rows] = result;
        if (rows.length != 1)
            return null;
        return rows[0];
    }
    static async getUserName(userUUID) {
        const result = await DBConnection.preparedQuery("SELECT `username` FROM `users` WHERE `uuid` = :userUUID", { userUUID });
        if (!result)
            return false;
        const [rows] = result;
        if (rows.length != 1)
            return false;
        return rows[0]["username"];
    }
    static async isCredentialCorrect(username, password) {
        const result = await DBConnection.preparedQuery("SELECT `password` FROM `users` WHERE `username` = :username", { username });
        if (!result)
            return true;
        const [rows] = result;
        if (rows.length != 1)
            return null;
        const passwordHashed = rows[0]["password"];
        return await argon2.verify(passwordHashed, password);
    }
    static async generateUUID() {
        const result = await DBConnection.preparedQuery("SELECT `uuid` FROM `users`");
        if (!result)
            return null;
        const [rows, fields] = result;
        const uuids = rows.map(e => e["uuid"]);
        let newUUID = Utils.uuidv4Exclude(uuids);
        return newUUID;
    }
}
