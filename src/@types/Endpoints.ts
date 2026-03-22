import { Digit, ShareDigits, ShareFlavors } from "./Api.js";
import { DB } from "./db.js";
import { MainFlavor } from "./Flavors.js";
import { DishVolumes, MultiplayerServerDish, ServerDish, ServerFlavorSynthLine, UUID } from "./User.js";

export type UserEndpointLoginBody = {
    username?: string;
    password?: string;
}

export type UserEndpointRegisterBody = {
    username?: string;
    password?: string;
    email?: string;
}

export type RestaurantEndpointLoadBody = {
    sortedAfter?: "newest" | "oldest" | "flavorCount";
    page?: number;
}

export type DishesEndpointLoadDishesBody = UserAction;

export type DishesEndpointUpdateDishBody = UserAction & {
    mainFlavor?: MainFlavor;
    name?: string;
    tracks?: ServerFlavorSynthLine[];
    volumes?: DishVolumes;
    uuid?: UUID;
    customFlavors: UUID[];
};

export type DishesEndpointAddDishBody = UserAction & {
    mainFlavor?: MainFlavor;
    name?: string;
    tracks?: ServerFlavorSynthLine[];
    volumes?: DishVolumes;
    uuid?: UUID;
    customFlavors?: UUID[];
};

export type DishesEndpointDeleteDishBody = UserAction & {
    uuid?: UUID;
}

export type UserAction = {
    jwt?: string;
}

export type ShareEndpointBody = UserAction & {
    flavors?: ShareFlavors;
    dish?: ServerDish;
}

export type ShareEndpointSetDishStateBody = UserAction & {
    dishUUID: UUID;
    visibility: DB.PublishVisibility;
};

export type ShareEndpointOpenBody = {
    type: "code" | "flavors" | "aiImage";
    aiImage?: string;
    flavors?: ShareFlavors;
    code?: ShareDigits;
}

export type MultiplayerEndpointJoinBody = UserAction & {
    code: ShareDigits;
    name: string;
}

export type MultiplayerEndpointCreateBody = UserAction & {
    dishUUID?: UUID;
    dish?: MultiplayerServerDish;
    // customFlavors?: DB.ServerCustomFlavor[];
    name: string;
}

export type CustomFlavorGetPublicBody = {
    filter: "newest" | "oldest" | "most_downloaded";
    page: number;
}

export type CustomFlavorAddBody = UserAction & {
    uuid: UUID;
    name: string;
    audio: string;
    image: string;
    colors: [string, string, string];
}

export type CustomFlavorDeleteBody = UserAction & {
    uuid: UUID;
}

export type CustomFlavorGetAllBody = UserAction & {
    localFlavors?: DB.ServerCustomFlavor[];
};

export type CustomFlavorUpdateVisibilityBody = UserAction & {
    uuid: UUID;
    is: boolean;
};