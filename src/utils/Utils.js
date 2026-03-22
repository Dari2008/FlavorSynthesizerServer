"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTUtils = void 0;
var uuid_1 = require("uuid");
var jsonwebtoken_1 = require("jsonwebtoken");
var Dotenv_js_1 = require("../Dotenv.js");
var Utils = /** @class */ (function () {
    function Utils() {
    }
    Utils.uuidv4 = function () {
        return (0, uuid_1.v4)();
    };
    Utils.uuidv4Exclude = function (allreadyused) {
        var uuid = null;
        do {
            uuid = (0, uuid_1.v4)();
        } while (allreadyused.includes(uuid));
        return uuid;
    };
    return Utils;
}());
exports.default = Utils;
var JWTUtils = /** @class */ (function () {
    function JWTUtils() {
    }
    JWTUtils.getData = function (jwtstr) {
        var _a;
        var key = (0, Dotenv_js_1.default)().JWT_KEY;
        try {
            if (!jsonwebtoken_1.default.verify(jwtstr, key, {
                ignoreExpiration: false,
            }))
                return null;
            var data = (_a = jsonwebtoken_1.default.decode(jwtstr, {
                complete: true,
                json: true
            })) === null || _a === void 0 ? void 0 : _a.payload;
            return data;
        }
        catch (ex) {
            return null;
        }
    };
    JWTUtils.checkJWTAndResponse = function (jwt, res) {
        var data = this.getData(jwt);
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
    };
    // public static checkForValidity(jwtData: JWTData) {
    // }
    JWTUtils.createJWT = function (username, uuid) {
        var key = (0, Dotenv_js_1.default)().JWT_KEY;
        var expDate = Date.now() + 60 * 60 * 24 * 30;
        var payload = {
            uuid: uuid,
            username: username,
            // iat: Date.now(),
            // exp: expDate
        };
        var jwtresult = jsonwebtoken_1.default.sign(payload, key, {
            expiresIn: 60 * 60 * 24 * 30 * 1000,
        });
        return [jwtresult, expDate];
    };
    return JWTUtils;
}());
exports.JWTUtils = JWTUtils;
