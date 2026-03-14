import { UUID } from "node:crypto";
import { DishVolumes, RestaurantDish, ServerDish } from "./User";
import { Flavor } from "./Flavors";

export type APIResponse<T, E extends object = {}> = SuccessAPIResponse<T> | ErrorAPIResponse<E>;

export type ErrorAPIResponse<E extends object = {}> = E & {
    status: "error";
    message: string;
    logout?: boolean;
}

export type SuccessAPIResponse<T> = T & {
    status: "success";
    message?: string;
}

export type LoginResponse = {
    jwtData: JWTData;
    displayName: string;
    uuid: string;
};

export type RegisterResponse = {
    jwtData: JWTData;
};

export type ShareErrorResponse = {
    flavorComboExists: boolean;
}

export type ShareResponse = {
    dishData: {
        code: ShareDigits;
        aiImage: string;
    };
    changedUUID: UUID | undefined;
};

export type OpenShareResponse = {
    dish: ServerDish;
    // aiImage: string;
    // uuid: string;
    // share: {
    //     code: ShareDigits,
    //     flavors: ShareFlavors
    // };
    // name: string;
    // createdAt: number;
    // createdBy: string;
    // publishState: "private" | "public";
    // volumes: DishVolumes;
}

export type DishLoadResponse = {
    dishes: ServerDish[];
}

export type AddDishResponse = {
    changedUUIDs: {
        [key: string]: string;
    };
}

export type FlavorsSelected = {
    flavor: Flavor;
    index: number;
};

export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ShareDigits = [Digit, Digit, Digit, Digit, Digit, Digit];
export type ShareFlavors = [Flavor, Flavor, Flavor, Flavor, Flavor, Flavor];

type JWTData = {
    jwt: string;
    allowedUntil: number;
}

export type VisibilityStateChangeResponse = {

}

export type LoadRestaurantData = {
    dishes: RestaurantDish[];
}

export type PageCountRestaurantData = {
    pages: number;
}

export type ImageAIResponse = {
    image: {
        type: "base64",
        base64: string
    };
    usage: {
        type: "credits",
        credits: number
    }
}

export type MultiplayerJoinResponse = {
    endpointUUID: UUID;
    gameUUID: UUID;
};

export type MultiplayerCreateResponse = {
    gameUUID: UUID;
    endpointUUID: UUID;
    code: ShareDigits;
}

export type PlayerJoinResponse = {
    playerState: {
        muted: boolean;
        kick: boolean;
        onlyView: boolean;
    };
}