export default class EndpointUtils {
    static isBodyCorreclyFormatted(body, format) {
        function checkForArray(array, format, key) {
            if (!array && !format.isNullable)
                return `${key} has to be set`;
            if (!array && format.isNullable)
                return true;
            if (format.length && array.length > format.length)
                return `${key} has too many elements`;
            if (format.length && array.length < format.length)
                return `${key} has too few elements`;
            if (!Array.isArray(array))
                return `${key} is not an array`;
            let i = 0;
            for (const val of array) {
                i++;
                if (val == null || val == undefined && !format.isNullable)
                    return `${key}[${i - 1}] has to be set`;
                const success = check(val, format.arrayValues, key);
                if (success !== true)
                    return success;
            }
            return true;
        }
        function checkForObject(object, format, key) {
            if ((object == null || object == undefined) && !format.isNullable)
                return `${key} has to be set`;
            if (!object && format.isNullable)
                return true;
            if (Array.isArray(object))
                return `${key} is not an object`;
            for (const key of Object.keys(format.children)) {
                if (!format.children[key])
                    continue;
                if ((object[key] == null || object[key] == undefined) && !format.children[key].isNullable)
                    return `${key} has to be set`;
                const success = check(object[key], format.children[key], key);
                if (success !== true)
                    return success;
            }
            return true;
        }
        function checkForString(string, format, key) {
            if ((string == undefined || string == null) && !format.isNullable)
                return `${key} has to be set`;
            if ((string == undefined || string == null) && format.isNullable)
                return true;
            if (Array.isArray(string))
                return `${key} has to be a string`;
            if (format.length && (!string.length || string.length != format.length))
                return `${key} has to be ${format.length} characters long`;
            if (format.allowedValues && !format.allowedValues.includes(string))
                return `${key} has to be one of ${format.allowedValues.join(" | ")}`;
            if (typeof string != "string")
                return `${key} has to be a string`;
            if (format.syntax && !string.match(format.syntax))
                return `${key} ${format.errorMessageSyntax}`;
            return true;
        }
        function checkForBoolean(boolean, format, key) {
            if ((boolean == undefined || boolean == null) && !format.isNullable)
                return `${key} has to be set`;
            if ((boolean == undefined || boolean == null) && format.isNullable)
                return true;
            if (typeof boolean != "boolean")
                return `${key} has to be a boolean`;
            return true;
        }
        function checkForNumber(number, format, key) {
            //Lol 0 was conmsidered as not set
            if ((number == undefined || number == null) && !format.isNullable)
                return `${key} has to be set`;
            if ((number == undefined || number == null) && format.isNullable)
                return true;
            if (typeof number != "number")
                return `${key} has to be a number`;
            return true;
        }
        function check(any, format, key) {
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
        }
        else if (format.type == "object") {
            return checkForObject(body, format, "");
        }
        return `Body is not correctly formatted`;
    }
    static checkAndSend(body, format, res) {
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
    static sendError(res, error, statusCode, other = {}) {
        res.status(statusCode);
        res.send({
            ...other,
            status: "error",
            message: error
        });
    }
    static sendOk(res, data = {}) {
        res.status(200);
        res.send({
            ...data,
            status: "success",
        });
    }
}
