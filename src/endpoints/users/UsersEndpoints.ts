import { Express } from "express";
import { UserEndpointLoginBody, UserEndpointRegisterBody } from "../../@types/Endpoints";
import EndpointUtils from "../utils/EndpointUtils";
import { APIResponse, LoginResponse, RegisterResponse } from "../../@types/Api";
import { USERS_LOGIN_BODY, USERS_REGISTER_BODY } from "../../@types/ApiBodyFormats/Users";
import Users from "../../sql/Users";
import { JWTUtils } from "../../utils/Utils";

export default class UsersEndpoints {
    constructor(app: Express) {
        this.init(app);
    }

    private init(app: Express) {

        app.post<string, any, APIResponse<LoginResponse>>("/users/login", async (handle, res) => {
            const body = handle.body as UserEndpointLoginBody;
            if (!EndpointUtils.checkAndSend(body, USERS_LOGIN_BODY, res)) return;

            const username = body.username!;
            const password = body.password!;

            if (!await Users.isCredentialCorrect(username, password)) {
                EndpointUtils.sendError(res, "Credentials expired (0x000)", 401);
                return;
            }

            const user = await Users.getUser(username);
            if (!user) {
                EndpointUtils.sendError(res, "Failed to login (0x001)", 500);
                return;
            }

            const [jwt, allowedUntil] = JWTUtils.createJWT(username, user.uuid);


            EndpointUtils.sendOk(res, {
                displayName: user.username,
                jwtData: {
                    jwt,
                    allowedUntil,
                },
                uuid: user.uuid
            });
        });

        app.post<string, any, APIResponse<RegisterResponse>>("/users/register", async (handle, res) => {
            const body = handle.body as UserEndpointRegisterBody;
            if (!EndpointUtils.checkAndSend(body, USERS_REGISTER_BODY, res)) return;

            const username = body.username!;
            const password = body.password!;
            const email = body.email!;

            if (await Users.usernameExists(username)) {
                EndpointUtils.sendError(res, "Username allready taken (0x002)", 401);
                return;
            }

            const success = await Users.createUser(username, password, email);
            if (!success) {
                EndpointUtils.sendError(res, "Failed to create account (0x003)", 401);
                return;
            }

            const user = await Users.getUser(username);
            if (!user) {
                EndpointUtils.sendError(res, "Failed to login (0x004)", 401);
                return;
            }

            const [jwt, allowedUntil] = JWTUtils.createJWT(username, user.uuid);


            EndpointUtils.sendOk(res, {
                displayName: user.username,
                jwtData: {
                    jwt,
                    allowedUntil,
                },
                uuid: user.uuid
            });
        });
    }

}