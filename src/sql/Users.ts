import { ResultSetHeader, RowDataPacket } from "mysql2";
import { UUID } from "../@types/User";
import { DBConnection } from "./DBConnection";
import argon2 from "argon2";
import Utils, { JWTUtils } from "../utils/Utils";
import useDotEnv from "../Dotenv";
import { DB } from "../@types/db";

export default class Users {

    public static async isValidUser(userUUID: UUID): Promise<boolean> {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM `users` WHERE `uuid` = :userUUID", { userUUID });
        if (!result) return true;
        const [rows] = result;
        return rows[0]["cnt"] > 0;
    }

    public static async usernameExists(username: string): Promise<boolean> {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM `users` WHERE `username` = :username", { username });
        if (!result) return true;
        const [rows] = result;
        return rows[0]["cnt"] > 0;
    }

    public static async createUser(username: string, password: string, email: string) {
        const uuid = await this.generateUUID();
        const hashedPassword = await argon2.hash(password, {
            type: argon2.argon2i
        });
        if (!uuid) return false;
        if (!hashedPassword) return false;

        const result = await DBConnection.preparedQuery<ResultSetHeader>("INSERT INTO `users` (`uuid`, `email`, `password`, `username`) VALUES (:uuid, :email, :password, :username)",
            {
                username,
                email,
                password: hashedPassword,
                uuid: uuid
            });
        if (!result) return false;
        return result[0].affectedRows == 1;
    }

    public static async getUser(username: string) {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT * FROM `users` WHERE `username`= :username OR `email`=:username", { username });
        if (!result) return null;
        const [rows] = result;
        if (rows.length != 1) return null;
        return rows[0] as DB.User;
    }

    public static async getUserName(userUUID: UUID) {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT `username` FROM `users` WHERE `uuid` = :userUUID", { userUUID });
        if (!result) return true;
        const [rows] = result;
        if (rows.length != 1) return null;
        return rows[0]["username"] as string;
    }

    public static async isCredentialCorrect(username: string, password: string) {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT `password` FROM `users` WHERE `username` = :username", { username });
        if (!result) return true;
        const [rows] = result;
        if (rows.length != 1) return null;

        const passwordHashed = rows[0]["password"];

        return await argon2.verify(passwordHashed, password);
    }

    private static async generateUUID() {
        const result = await DBConnection.preparedQuery<RowDataPacket[]>("SELECT `uuid` FROM `users`");
        if (!result) return null;
        const [rows, fields] = result;
        const uuids = rows.map(e => e["uuid"]);
        let newUUID = Utils.uuidv4Exclude(uuids);
        return newUUID;
    }
}

type QueryResponse<T> = false | T;