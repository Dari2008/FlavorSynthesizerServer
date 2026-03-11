import { BodyFormat, BodyFormatNodes } from "../../endpoints/utils/EndpointUtils";
import { FLAVORS, MAIN_FLAVORS } from "../Flavors";
import { ServerDish, ServerFlavorElement, ServerFlavorSynthLine } from "../User";

export const USERS_LOGIN_BODY: BodyFormat = {
    type: "object",
    children: {
        "username": {
            type: "string",
            isNullable: false,
        },
        "password": {
            type: "string",
            isNullable: false,
        }
    }
};

export const USERS_REGISTER_BODY: BodyFormat = {
    type: "object",
    children: {
        "username": {
            type: "string",
            isNullable: false,
        },
        "password": {
            type: "string",
            isNullable: false,
        },
        "email": {
            type: "string",
            isNullable: false,
            syntax: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g,
            errorMessageSyntax: "is not in correct format"
        }
    }
};

export const DISHES_LOAD_BODY: BodyFormat = {
    type: "object",
    children: {
        "jwt": {
            type: "string"
        }
    }
}

export const RESTAURANT_LOAD_BODY: BodyFormat = {
    type: "object",
    isNullable: true,
    children: {
        "sortedAfter": {
            type: "string",
            allowedValues: [
                "newest",
                "oldest",
                "flavorCount"
            ],
            isNullable: true
        },
        "limit": {
            type: "number",
            isNullable: true
        }
    }
}

export const VOLUMES_FORMAT: BodyFormatNodes = {
    type: "object",
    children: {
        mainFlavor: {
            type: "number"
        },
        flavors: {
            type: "number"
        },
        master: {
            type: "number"
        }
    }
};

export const TRACKS_ELEMENTS_FORMAT: BodyFormatNodes = {
    type: "object",
    children: {
        flavor: {
            type: "string",
            allowedValues: FLAVORS
        },
        from: {
            type: "number"
        },
        to: {
            type: "number"
        }
    }
}

export const TRACKS_FORMAT: BodyFormatNodes = {
    type: "array",
    arrayValues: {
        type: "object",
        children: {
            elements: {
                type: "array",
                arrayValues: TRACKS_ELEMENTS_FORMAT
            },
            muted: {
                type: "boolean"
            },
            solo: {
                type: "boolean"
            },
            volume: {
                type: "number"
            }
        }
    }
};

export const PUBLISH_STATE_FORMAT: BodyFormatNodes = {
    type: "string",
    allowedValues: [
        "public",
        "private"
    ]
};

export const DISH_FORMAT: BodyFormatNodes = {
    type: "object",
    children: {
        volumes: VOLUMES_FORMAT,
        tracks: TRACKS_FORMAT,
        publishState: PUBLISH_STATE_FORMAT,
        name: {
            type: "string"
        },
        mainFlavor: {
            type: "string",
            allowedValues: MAIN_FLAVORS
        },
    }
}

export const SHARE_BODY: BodyFormat = {
    type: "object",
    children: {
        "dish": DISH_FORMAT,
        "flavors": {
            type: "array",
            isNullable: false,
            length: 6,
            arrayValues: {
                type: "string",
                isNullable: false,
                allowedValues: FLAVORS
            }
        },
        jwt: {
            type: "string",
            isNullable: true
        }
    }
}

export const UUID_FORMAT: BodyFormatNodes = {
    type: "string",
    syntax: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    errorMessageSyntax: "The UUID is not correctly formatted!"
};

export const SET_DISH_STATE_BODY: BodyFormat = {
    type: "object",
    children: {
        jwt: {
            type: "string"
        },
        dishUUID: UUID_FORMAT,
        visibility: PUBLISH_STATE_FORMAT
    }
}

export const OPEN_SHARE_BODY: BodyFormat = {
    type: "object",
    children: {
        type: {
            type: "string",
            allowedValues: [
                "flavors",
                "code",
                "aiImage"
            ]
        },
        aiImage: {
            type: "string",
            isNullable: true
        },
        flavors: {
            type: "array",
            isNullable: true,
            arrayValues: {
                type: "string",
                allowedValues: FLAVORS
            },
            length: 6
        },
        code: {
            type: "array",
            isNullable: true,
            arrayValues: {
                type: "number"
            },
            length: 6
        }
    }
}