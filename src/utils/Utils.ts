import { v4 } from "uuid";
import { UUID } from "../@types/User";
import jwt from "jsonwebtoken";
import useDotEnv from "../Dotenv";
import { APIResponse } from "../@types/Api";
import { Response } from "express";

export default class Utils {
    static uuidv4() {
        return v4() as `${string}-${string}-${string}-${string}-${string}`;
    }

    static uuidv4Exclude(allreadyused: string[]): UUID {
        let uuid = null;
        do {
            uuid = v4() as UUID;
        } while (allreadyused.includes(uuid));
        return uuid;
    }
}

export class JWTUtils {
    public static getData(jwtstr: string): JWTData | null {
        const key = useDotEnv().JWT_KEY;

        try {
            if (!jwt.verify(jwtstr, key, {
                ignoreExpiration: false,
            })) return null;

            const data = jwt.decode(jwtstr, {
                complete: true,
                json: true
            })?.payload;
            return data as JWTData;
        } catch (ex) {
            return null;
        }
    }

    public static checkJWTAndResponse<T>(jwt: string, res: Response<APIResponse<T, {}>, Record<string, any>>): null | JWTData {
        const data = this.getData(jwt);
        if (!data) {
            res.status(401);
            res.send({
                status: "error",
                message: "Expired Credentials",
                logout: true
            });
            return null;
        }
        return data;
    }

    // public static checkForValidity(jwtData: JWTData) {

    // }

    public static createJWT(username: string, uuid: string): [string, number] {
        const key = useDotEnv().JWT_KEY;

        const expDate = Date.now() + 60 * 60 * 24 * 30;
        const payload = {
            uuid,
            username,
            // iat: Date.now(),
            // exp: expDate
        } as JWTData;

        const jwtresult = jwt.sign(payload, key, {
            expiresIn: 60 * 60 * 24 * 30 * 1000,
        });
        return [jwtresult, expDate];
    }

}

export type JWTData = {
    username: string;
    uuid: UUID;
    // iat: number;
    // exp: number;
}