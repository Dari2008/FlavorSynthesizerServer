import { configDotenv } from "dotenv";
let DOTENV = {};
export function initDotEnv() {
    const result = configDotenv({
        path: "./.env"
    });
    DOTENV = (result.parsed ?? {});
}
export default function useDotEnv() {
    return DOTENV;
}
