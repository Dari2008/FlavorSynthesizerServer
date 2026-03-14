import { isStringObject } from "util/types";
import { APIResponse, ErrorAPIResponse } from "../../@types/Api";
import { Response } from "express";

export default class EndpointUtils {
    public static isBodyCorreclyFormatted(body: any, format: BodyFormat): true | string {

        function checkForArray(array: any[], format: BodyFormat_Array, key: string): true | string {
            if (!array && !format.isNullable) return `${key} has to be set`;
            if (!array && format.isNullable) return true;
            if (format.length && array.length > format.length) return `${key} has too many elements`;
            if (format.length && array.length < format.length) return `${key} has too few elements`;
            if (!Array.isArray(array)) return `${key} is not an array`;

            let i = 0;
            for (const val of array) {
                i++
                if (val == null || val == undefined && !format.isNullable) return `${key}[${i - 1}] has to be set`;
                const success = check(val, format.arrayValues, key);
                if (success !== true) return success;
            }
            return true;
        }

        function checkForObject(object: any, format: BodyFormat_Object, key: string): true | string {
            if ((object == null || object == undefined) && !format.isNullable) return `${key} has to be set`;
            if (!object && format.isNullable) return true;
            if (Array.isArray(object)) return `${key} is not an object`;

            for (const key of Object.keys(format.children)) {
                if (!format.children[key]) continue;
                if ((object[key] == null || object[key] == undefined) && !format.children[key].isNullable) return `${key} has to be set`;
                const success = check(object[key], format.children[key], key);
                if (success !== true) return success;
            }
            return true;
        }

        function checkForString(string: any, format: BodyFormat_String, key: string): true | string {
            if ((string == undefined || string == null) && !format.isNullable) return `${key} has to be set`;
            if ((string == undefined || string == null) && format.isNullable) return true;
            if (Array.isArray(string)) return `${key} has to be a string`;
            if (format.length && (!string.length || string.length != format.length)) return `${key} has to be ${format.length} characters long`;
            if (format.allowedValues && !format.allowedValues.includes(string)) return `${key} has to be one of ${format.allowedValues.join(" | ")}`
            if (typeof string != "string") return `${key} has to be a string`;
            if (format.syntax && !format.syntax.test(string)) return `${key} ${format.errorMessageSyntax}`
            return true;
        }

        function checkForBoolean(boolean: any, format: BodyFormat_Boolean, key: string): true | string {
            if ((boolean == undefined || boolean == null) && !format.isNullable) return `${key} has to be set`;
            if ((boolean == undefined || boolean == null) && format.isNullable) return true;
            if (typeof boolean != "boolean") return `${key} has to be a boolean`;
            return true;
        }

        function checkForNumber(number: any, format: BodyFormat_Number, key: string): true | string {
            //Lol 0 was conmsidered as not set
            if ((number == undefined || number == null) && !format.isNullable) return `${key} has to be set`;
            if ((number == undefined || number == null) && format.isNullable) return true;
            if (typeof number != "number") return `${key} has to be a number`;
            return true;
        }

        function check(any: any, format: BodyFormat_Array | BodyFormat_Object | BodyFormat_String | BodyFormat_Boolean | BodyFormat_Number, key: string) {
            switch (format.type) {
                case "string":
                    return checkForString(any, format, key);
                case "number":
                    return checkForNumber(any, format, key);
                case "boolean":
                    return checkForBoolean(any, format, key);
                case "object":
                    return checkForObject(any, format, key);
                case "array":
                    return checkForArray(any, format, key);
            }
        }

        if (format.type == "array") {
            return checkForArray(body, format, "");
        } else if (format.type == "object") {
            return checkForObject(body, format, "");
        }

        return `Body is not correctly formatted`;
    }

    public static checkAndSend<T, E extends object>(body: any, format: BodyFormat, res: Response<APIResponse<T, E>, Record<string, any>>) {
        const validFormat = EndpointUtils.isBodyCorreclyFormatted(body, format);
        if (validFormat !== true) {
            res.status(400);
            res.send({
                status: "error",
                message: validFormat
            });
            return false;
        }
        return true;
    }

    public static sendError<T, E extends object>(res: Response<APIResponse<T, ErrorAPIResponse<E>>, Record<string, any>>, error: string, statusCode: number, other: Omit<ErrorAPIResponse<E>, "status" | "message"> = {} as any) {
        res.status(statusCode);
        res.send({
            ...other,
            status: "error",
            message: error
        } as ErrorAPIResponse<E>);
    }

    public static sendOk<T, E extends object>(res: Response<APIResponse<T, ErrorAPIResponse<E>>, Record<string, any>>, data: T = {} as T) {
        res.status(200);
        res.send({
            ...data,
            status: "success",
        });
    }
}

export type BodyFormat = BodyFormat_Object | BodyFormat_Array;

export type BodyFormatNodes = BodyFormat_String | BodyFormat_Number | BodyFormat_Boolean | BodyFormat_Object | BodyFormat_Array;


export type BodyFormat_Defaut = {
    isNullable?: boolean;
}

export type BodyFormat_String = BodyFormat_Defaut & {
    type: "string";
    length?: number;
    allowedValues?: string[];
    syntax?: RegExp;
    errorMessageSyntax?: string;
}

export type BodyFormat_Number = BodyFormat_Defaut & {
    type: "number";
}

export type BodyFormat_Boolean = BodyFormat_Defaut & {
    type: "boolean";
}

export type BodyFormat_Object = BodyFormat_Defaut & {
    type: "object";
    children: {
        [key: string]: BodyFormatNodes | undefined;
    };
}

export type BodyFormat_Array = BodyFormat_Defaut & {
    type: "array";
    arrayValues: BodyFormatNodes;
    length?: number;
}