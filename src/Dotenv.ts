import { configDotenv } from "dotenv"

let DOTENV: Dotenv = {} as any;

type Dotenv = {
    DB_NAME: string;
    DB_PASSWORD: string;
    DB_USERNAME: string;
    DB_HOST: string;
    DB_PORT: number;
    JWT_KEY: string;
    AI_KEY: string;
}

export function initDotEnv() {
    const result = configDotenv({
        path: "./.env"
    });
    DOTENV = ((result.parsed as any | undefined) ?? {}) as Dotenv;
}

export default function useDotEnv(): Dotenv {
    return DOTENV;
}