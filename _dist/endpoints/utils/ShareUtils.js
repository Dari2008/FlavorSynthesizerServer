export default class ShareUtils {
    static isShareCodeEqual(code1, code2) {
        if (code1.length != code2.length)
            return false;
        return !code1.some((e, i) => e != code2[i]);
    }
}
