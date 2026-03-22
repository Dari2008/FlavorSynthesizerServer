import { FLAVORS, MAIN_FLAVORS } from "../Flavors.js";
export const USERS_LOGIN_BODY = {
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
export const USERS_REGISTER_BODY = {
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
export const DISHES_LOAD_BODY = {
    type: "object",
    children: {
        "jwt": {
            type: "string"
        }
    }
};
export const RESTAURANT_LOAD_BODY = {
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
        "page": {
            type: "number",
            isNullable: true
        }
    }
};
export const VOLUMES_FORMAT = {
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
export const TRACKS_ELEMENTS_FORMAT = {
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
};
export const TRACKS_FORMAT = {
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
export const PUBLISH_STATE_FORMAT = {
    type: "string",
    allowedValues: [
        "public",
        "private"
    ]
};
export const DISH_FORMAT = {
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
};
export const SHARE_BODY = {
    type: "object",
    children: {
        "dish": {
            type: "object",
            children: {
                ...DISH_FORMAT.children,
                publishState: undefined
            }
        },
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
};
export const UUID_FORMAT = {
    type: "string",
    syntax: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    errorMessageSyntax: "The UUID is not correctly formatted!"
};
export const SET_DISH_STATE_BODY = {
    type: "object",
    children: {
        jwt: {
            type: "string"
        },
        dishUUID: UUID_FORMAT,
        visibility: PUBLISH_STATE_FORMAT
    }
};
export const OPEN_SHARE_BODY = {
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
};
export const UPDATE_DISH_BODY = {
    type: "object",
    children: {
        mainFlavor: {
            type: "string",
            allowedValues: MAIN_FLAVORS
        },
        name: {
            type: "string"
        },
        tracks: TRACKS_FORMAT,
        volumes: VOLUMES_FORMAT,
        uuid: UUID_FORMAT
    }
};
export const ADD_DISH_BODY = {
    type: "object",
    children: {
        mainFlavor: {
            type: "string",
            allowedValues: MAIN_FLAVORS
        },
        name: {
            type: "string"
        },
        tracks: TRACKS_FORMAT,
        volumes: VOLUMES_FORMAT,
        uuid: UUID_FORMAT
    }
};
export const DELETE_DISH_BODY = {
    type: "object",
    children: {
        uuid: UUID_FORMAT
    }
};
export const MULTIPLAYER_JOIN_BODY = {
    type: "object",
    children: {
        code: {
            type: "array",
            length: 6,
            arrayValues: {
                type: "number"
            }
        },
        jwt: {
            type: "string",
            isNullable: true
        },
        name: {
            type: "string"
        }
    }
};
export const MULTIPLAYER_CREATE_BODY = {
    type: "object",
    children: {
        dishUUID: {
            ...UUID_FORMAT,
            isNullable: true
        },
        dish: {
            ...DISH_FORMAT,
            isNullable: true
        },
        jwt: {
            type: "string",
            isNullable: true
        },
        name: {
            type: "string"
        }
    }
};
export const CUSTOM_FLAVORS_GET_PUBLIC = {
    type: "object",
    children: {
        filter: {
            type: "string",
            allowedValues: [
                "newest",
                "oldest",
                "most_downloaded"
            ]
        },
        page: {
            type: "number"
        }
    }
};
export const CUSTOM_FLAVORS_ADD = {
    type: "object",
    children: {
        jwt: {
            type: "string"
        },
        name: {
            type: "string"
        },
        audio: {
            type: "string",
            syntax: /(.*?);base64,(.*)/g,
            errorMessageSyntax: "audio is not a valid base64 string"
        },
        image: {
            type: "string",
            syntax: /(.*?);base64,(.*)/g,
            errorMessageSyntax: "image is not a valid base64 string"
        },
        colors: {
            type: "array",
            length: 3,
            arrayValues: {
                type: "string",
                syntax: /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/gm,
                errorMessageSyntax: " contains a color that doesnt have a valid syntax"
            }
        },
        uuid: UUID_FORMAT
    }
};
export const CUSTOM_FLAVORS_REMOVE = {
    type: "object",
    children: {
        jwt: {
            type: "string"
        },
        uuid: UUID_FORMAT
    }
};
export const CUSTOM_FLAVORS_GET_ALL = {
    type: "object",
    children: {
        jwt: {
            type: "string"
        },
        localFlavors: {
            type: "array",
            isNullable: true,
            arrayValues: {
                type: "object",
                children: {
                    name: {
                        type: "string"
                    },
                    audio: {
                        type: "string",
                        syntax: /(.*?);base64,(.*)/g,
                        errorMessageSyntax: "audio is not a valid base64 string"
                    },
                    image: {
                        type: "string",
                        syntax: /(.*?);base64,(.*)/g,
                        errorMessageSyntax: "image is not a valid base64 string"
                    },
                    colors: {
                        type: "array",
                        length: 3,
                        arrayValues: {
                            type: "string",
                            syntax: /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/gm,
                            errorMessageSyntax: "contains a color that doesnt have a valid syntax"
                        }
                    },
                    uuid: UUID_FORMAT
                }
            }
        }
    }
};
export const CUSTOM_FLAVORS_UPDATE_VISIBILITY = {
    type: "object",
    children: {
        jwt: {
            type: "string"
        },
        is: {
            type: "boolean"
        },
        uuid: UUID_FORMAT
    }
};
