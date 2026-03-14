import { Digit, ShareDigits, ShareFlavors } from "./Api";
import { DB } from "./db";
import { MainFlavor } from "./Flavors";
import { DishVolumes, ServerDish, ServerFlavorSynthLine, UUID } from "./User";

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
};

export type DishesEndpointAddDishBody = UserAction & {
    mainFlavor?: MainFlavor;
    name?: string;
    tracks?: ServerFlavorSynthLine[];
    volumes?: DishVolumes;
    uuid?: UUID;
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
    dish?: ServerDish;
    name: string;
}