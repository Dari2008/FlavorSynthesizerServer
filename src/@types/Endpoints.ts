import { ShareDigits, ShareFlavors } from "./Api";
import { DB } from "./db";
import { ServerDish, UUID } from "./User";

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
    limit?: number;
}

export type DishesEndpointLoadDishesBody = UserAction;

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