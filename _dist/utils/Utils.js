import { v4 } from "uuid";
import jwt from "jsonwebtoken";
import useDotEnv from "../Dotenv.js";
export default class Utils {
    static uuidv4() {
        return v4();
    }
    static uuidv4Exclude(allreadyused) {
        let uuid = null;
        do {
            uuid = v4();
        } while (allreadyused.includes(uuid));
        return uuid;
    }
}
export class JWTUtils {
    static getData(jwtstr) {
        const key = useDotEnv().JWT_KEY;
        try {
            if (!jwt.verify(jwtstr, key, {
                ignoreExpiration: false,
            }))
                return null;
            const data = jwt.decode(jwtstr, {
                complete: true,
                json: true
            })?.payload;
            return data;
        }
        catch (ex) {
            return null;
        }
    }
    static checkJWTAndResponse(jwt, res) {
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
    static createJWT(username, uuid) {
        const key = useDotEnv().JWT_KEY;
        const expDate = Date.now() + 60 * 60 * 24 * 30;
        const payload = {
            uuid,
            username,
            // iat: Date.now(),
            // exp: expDate
        };
        const jwtresult = jwt.sign(payload, key, {
            expiresIn: 60 * 60 * 24 * 30 * 1000,
        });
        return [jwtresult, expDate];
    }
}
