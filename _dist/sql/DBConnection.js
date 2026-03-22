import mysql2 from "mysql2/promise";
import useDotEnv from "../Dotenv.js";
export class DBConnection {
    static conn = null;
    static initDBConnection() {
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
    static async preparedQuery(query, args = {}) {
        if (!DBConnection.conn)
            return false;
        return new Promise(async (res, rej) => {
            const result = await DBConnection.conn?.execute(query, args).catch(rej);
            if (!result) {
                res(undefined);
                return;
            }
            const [rows, fields] = result;
            res([rows, fields]);
        });
    }
}
