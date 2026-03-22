import { ShareDigits } from "../../@types/Api.js";

export default class ShareUtils {
    public static isShareCodeEqual(code1: ShareDigits, code2: ShareDigits): boolean {
        if (code1.length != code2.length) return false;
        return !code1.some((e, i) => e != code2[i]);
    }
}