import type { Digit } from "./Api.js";
import { DB } from "./db.js";
import type { Flavor, MainFlavor } from "./Flavors.js";

export type User = {
    uuid: string;
    jwt: string;
    displayName: string;
}

export type ServerDish = {
    tracks: ServerFlavorSynthLine[];
    name: string;
    mainFlavor: MainFlavor;
    volumes: DishVolumes;
    publishState: "public" | "private";
    createdAt: string;
    createdBy: string;
    uuid: UUID;
    share: {
        code: [Digit, Digit, Digit, Digit, Digit, Digit] | undefined,
        flavors: [Flavor, Flavor, Flavor, Flavor, Flavor, Flavor] | undefined;
        aiImage: string | undefined;
    } | undefined;
    customFlavors: UUID[];
}

export type MultiplayerServerDish = Omit<ServerDish, "customFlavors"> & {
    customFlavors: DB.ServerCustomFlavor[];
}

export type RestaurantDish = Omit<ServerDish, "share"> & {
    share?: {
        aiImage?: string;
    }
};

export type DishVolumes = {
    master: number;
    mainFlavor: number;
    flavors: number;
};


export type FlavorElement = {
    from: number;
    to: number;
    uuid: UUID;
    flavor: Flavor;
}

export type ServerFlavorSynthLine = {
    uuid: UUID;
    elements: ServerFlavorElement[];
    volume: number;
    muted: boolean;
    solo: boolean;
};

export type ServerFlavorElement = {
    from: number;
    to: number;
    flavor: Flavor;
    uuid: UUID;
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`;