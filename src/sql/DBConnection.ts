import mysql2, { Pool } from "mysql2/promise";
import useDotEnv from "../Dotenv";

export class DBConnection {
    private static conn: Pool | null = null;

    public static initDBConnection() {

        const DOT_ENV = useDotEnv();

        DBConnection.conn = mysql2.createPool({
            host: DOT_ENV.DB_HOST,
            password: DOT_ENV.DB_PASSWORD,
            database: DOT_ENV.DB_NAME,
            user: DOT_ENV.DB_USERNAME,
            port: DOT_ENV.DB_PORT,
            connectionLimit: 10,
            waitForConnections: true,
            namedPlaceholders: true
        });
        console.log("Connection to db established");
    }

    public static async preparedQuery<T extends mysql2.QueryResult>(query: string, args: { [key: string]: string | number | boolean } | any[] = {}) {
        if (!DBConnection.conn) return false;
        return new Promise<[T, mysql2.FieldPacket[]] | undefined>(async (res, rej) => {
            const result = await DBConnection.conn?.execute<T>(query, args).catch(rej);
            if (!result) {
                res(undefined);
                return;
            }
            const [rows, fields] = result;
            res([rows, fields]);

        });
    }

}