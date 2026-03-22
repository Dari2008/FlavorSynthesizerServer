import { DBConnection } from "./DBConnection.js";
import sharp from "sharp";
import DishManager from "./DishManager.js";
import Utils from "../utils/Utils.js";
import useDotEnv from "../Dotenv.js";
import { randomInt } from "crypto";
export default class ShareManager {
    static async deleteShare(userUUID, dishUUID) {
        const result = await DBConnection.preparedQuery("DELETE FROM `shares` WHERE `dish`=:dish", {
            dish: `${userUUID}.${dishUUID}`
        });
        if (!result)
            return false;
        const [res] = result;
        return res.affectedRows == 1;
    }
    static async getDishByAIImage(imageBase64) {
        if (imageBase64.includes(","))
            imageBase64 = imageBase64.split(",")[1];
        const buffer = Buffer.from(imageBase64, "base64");
        const { data, info } = await sharp(buffer)
            .raw()
            .toBuffer({ resolveWithObject: true });
        const digits = [];
        for (let pixel = 0; pixel < 6; pixel++) {
            const color = this.getPixelAt(data, info, [pixel, 0]);
            const digit = this.convertColorToDigit(color);
            digits.push(digit);
            console.log(pixel, digit, color);
        }
        return await this.getDishByCode(digits);
    }
    static setPixelAt(data, info, pos, { r, g, b, a }) {
        const index = (pos[0] + (pos[1] * info.width)) * info.channels;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        if (info.channels >= 4) {
            data[index + 3] = a;
        }
    }
    static getPixelAt(data, info, pos) {
        const index = (pos[0] + (pos[1] * info.width)) * info.channels;
        return {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2]
        };
    }
    static convertColorToDigit({ r, g, b }) {
        const rVal = r;
        const gVal = g;
        const bVal = b;
        if (rVal == gVal && gVal == bVal)
            return rVal;
        const mostUsedDigit = {};
        if (mostUsedDigit[rVal])
            mostUsedDigit[rVal]++;
        else
            mostUsedDigit[rVal] = 1;
        if (mostUsedDigit[gVal])
            mostUsedDigit[gVal]++;
        else
            mostUsedDigit[gVal] = 1;
        if (mostUsedDigit[bVal])
            mostUsedDigit[bVal]++;
        else
            mostUsedDigit[bVal] = 1;
        let max = 0;
        let val = -1;
        for (const key of [rVal, gVal, bVal]) {
            if (mostUsedDigit[key] > max && key <= 9) {
                max = mostUsedDigit[key];
                val = key;
            }
        }
        return val;
    }
    static async getDishByFlavors(flavors) {
        const result = await DBConnection.preparedQuery(`
            SELECT \`dish\` FROM \`shares\` 
                WHERE flavors->>'$[0]' = :flavor1
                AND flavors->>'$[1]' = :flavor2
                AND flavors->>'$[2]' = :flavor3
                AND flavors->>'$[3]' = :flavor4
                AND flavors->>'$[4]' = :flavor5
                AND flavors->>'$[5]' = :flavor6
            `, {
            flavor1: flavors[0],
            flavor2: flavors[1],
            flavor3: flavors[2],
            flavor4: flavors[3],
            flavor5: flavors[4],
            flavor6: flavors[5],
        });
        if (!result)
            return null;
        const [rows] = result;
        if (rows.length != 1)
            return null;
        const row = rows[0];
        return this.recompileSharedDish(row["dish"]);
    }
    static async getDishByCode(code) {
        const result = await DBConnection.preparedQuery(`
            SELECT \`dish\` FROM \`shares\` 
                WHERE code->>'$[0]' = :code1
                AND code->>'$[1]' = :code2
                AND code->>'$[2]' = :code3
                AND code->>'$[3]' = :code4
                AND code->>'$[4]' = :code5
                AND code->>'$[5]' = :code6
            `, {
            code1: code[0],
            code2: code[1],
            code3: code[2],
            code4: code[3],
            code5: code[4],
            code6: code[5],
        });
        if (!result)
            return null;
        const [rows] = result;
        if (rows.length != 1)
            return null;
        const row = rows[0];
        return this.recompileSharedDish(row["dish"]);
    }
    static async recompileSharedDish(dish) {
        if (typeof dish === "string") {
            const idParts = dish.split(".");
            if (idParts.length !== 2)
                return null;
            const userUUID = idParts[0];
            const dishUUID = idParts[1];
            return DishManager.getDish(userUUID, dishUUID);
        }
        return dish;
    }
    static async existsSharedDishWithDish(dish) {
        const result = await DBConnection.preparedQuery("SELECT count(`dish`) as cnt FROM `shares` WHERE `dish` = :dish", {
            dish
        });
        if (!result)
            return false;
        const [rows] = result;
        if (rows.length != 1)
            return false;
        return rows[0]["cnt"] > 0;
    }
    static async share(userUUID, flavors, dish) {
        if (!!userUUID && userUUID != null) {
            const shareUUID = await this.generateUUID();
            const dishRef = `${userUUID}.${dish.uuid}`;
            const code = await this.generateCode();
            if (!code || !shareUUID)
                return;
            let aiImage = "";
            if ((await this.getAIGenCountForUser(userUUID)) <= 0 && await this.increaseAiGenCountOfUser(userUUID)) {
                const aiGenResult = await this.generateAIIMage(flavors, code);
                aiImage = !!aiGenResult ? aiGenResult : "";
            }
            console.log(userUUID, shareUUID, dishRef, aiImage, code, flavors);
            const result = await DBConnection.preparedQuery("INSERT INTO `shares` (`userUUID`, `uuid`, `dish`, `AIImage`, `code`, `flavors`) VALUES (:userUUID, :shareUUID, :dishRef, :aiImage, :code, :flavors)", {
                userUUID: userUUID,
                shareUUID,
                dishRef: JSON.stringify(dishRef),
                aiImage,
                code: JSON.stringify(code),
                flavors: JSON.stringify(flavors)
            });
            if (!result)
                return false;
            const [res] = result;
            if (res.affectedRows != 1)
                return false;
            return {
                code: code,
                flavors: flavors,
                aiImage: aiImage
            };
        }
        else {
            const shareUUID = await this.generateUUID();
            const code = await this.generateCode();
            let aiImage = "";
            if (!code || !shareUUID)
                return;
            const result = await DBConnection.preparedQuery("INSERT INTO `shares` (`uuid`, `dish`, `AIImage`, `code`, `flavors`) VALUES (:shareUUID, :dish, :aiImage, :code, :flavors)", {
                shareUUID,
                dish: JSON.stringify(dish),
                aiImage,
                code: JSON.stringify(code),
                flavors: JSON.stringify(flavors)
            });
            if (!result)
                return false;
            const [res] = result;
            if (res.affectedRows != 1)
                return false;
            return {
                code: code,
                flavors: flavors,
                aiImage: aiImage
            };
        }
    }
    static async getAIGenCountForUser(userUUID) {
        const result = await DBConnection.preparedQuery("SELECT `aiGenUsed` FROM `users` WHERE `uuid`=:userUUID", {
            userUUID
        });
        if (!result)
            return 10;
        const [rows] = result;
        if (rows.length != 1)
            return 10;
        return rows[0]["aiGenUsed"];
    }
    static async increaseAiGenCountOfUser(userUUID) {
        const result = await DBConnection.preparedQuery("UPDATE `users` SET aiGenUsed = aiGenUsed + 1 WHERE `uuid`=:userUUID", {
            userUUID
        });
        if (!result)
            return false;
        const [rows] = result;
        if (rows.affectedRows == 1)
            return true;
        return false;
    }
    static async generateAIIMage(flavors, code) {
        const key = useDotEnv().AI_KEY;
        const rawResponse = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
            headers: [
                ["Content-Type", "application/json"],
                ["Authorization", `Bearer ${key}`]
            ],
            body: JSON.stringify({
                "description": `Make a dish of all these flavors on a plate: ${flavors.join(",")}`,
                "image_size": {
                    "width": 64,
                    "height": 64
                },
                "no_background": true,
                "negative_description": `
                    blurry, low resolution, out of focus, distorted, incorrect anatomy,
                    extra limbs, text, watermark, logo, border, frame, background, shadows,
                    noise, artifacts, overexposed, underexposed, unnatural colors, unrealistic texture,
                    wrong fruit, half-sliced wrong, too much empty space, multiple fruits, crowded composition,
                    cartoon style, pixelated, grainy, bad lighting, tilted, cropped, incomplete, duplicated elements,
                    extra seeds, missing seeds
                `,
                "outline": "lineless",
                "shading": "flat shading",
                "detail": "medium detail",
                "coverage_percentage": 90
            })
        });
        const response = await rawResponse.json();
        if (rawResponse.status != 200) {
            switch (rawResponse.status) {
                case 401:
                    return "Failed to create ai image";
                case 402:
                    return "Insufficient Credits please write a message to +4901724067376 on WhatsApp or SMS";
                case 429:
                    return "Too many request please wait a minute";
                case 529:
                    return "Reate limit exceeded please try again later";
            }
            return "Failed to create ai image";
        }
        const image = response.image.base64;
        return this.applyCodeToImage(image, code);
    }
    static async applyCodeToImage(base64, code) {
        if (base64.includes(","))
            base64 = base64.split(",")[1];
        const buffer = Buffer.from(base64, "base64");
        const { data, info } = await sharp(buffer)
            .raw()
            .toBuffer({ resolveWithObject: true });
        for (let i = 0; i < 6; i++) {
            const digit = code[i];
            this.setPixelAt(data, info, [digit, 0], this.convertDigitToRgb(digit));
        }
        const outputBuffer = await sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: info.channels
            }
        }).png().toBuffer();
        return `data:image/png;base64,${outputBuffer.toString("base64")}`;
    }
    static convertDigitToRgb(digit) {
        const r = digit;
        const g = digit * 3;
        const b = digit * 7;
        const a = 0;
        return {
            r, g, b, a
        };
    }
    static async existsFlavorCombo(flavors) {
        const result = await DBConnection.preparedQuery(`
            SELECT *
                FROM \`shares\`
                WHERE flavors->>'$[0]' = :flavor1
                AND flavors->>'$[1]' = :flavor2
                AND flavors->>'$[2]' = :flavor3
                AND flavors->>'$[3]' = :flavor4
                AND flavors->>'$[4]' = :flavor5
                AND flavors->>'$[5]' = :flavor6;
            `, {
            flavor1: flavors[0],
            flavor2: flavors[1],
            flavor3: flavors[2],
            flavor4: flavors[3],
            flavor5: flavors[4],
            flavor6: flavors[5],
        });
        if (!result)
            return false;
        const [rows] = result;
        if (rows.length > 0)
            return true;
        return false;
    }
    static async generateCode() {
        const result = await DBConnection.preparedQuery("SELECT `code` FROM `shares`");
        if (!result)
            return false;
        const [rows] = result;
        const allCodes = rows.map(e => e["code"]);
        let code = this.code();
        while (allCodes.includes(code)) {
            code = this.code();
        }
        return code;
    }
    static async generateUUID() {
        const result = await DBConnection.preparedQuery("SELECT `uuid` FROM `shares`");
        if (!result)
            return false;
        const [rows] = result;
        const allUUIDs = rows.map(e => e["uuids"]);
        return Utils.uuidv4Exclude(allUUIDs);
    }
    static code() {
        return [
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9),
            randomInt(0, 9)
        ];
    }
}
