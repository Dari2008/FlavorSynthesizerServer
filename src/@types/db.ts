import { Digit, ShareDigits, ShareFlavors } from "./Api";
import { Flavor, MainFlavor } from "./Flavors";
import { DishVolumes, ServerDish, ServerFlavorSynthLine, UUID } from "./User"

export namespace DB {

    export type PublishVisibility = "public" | "private";

    export type DishUserReference = `${UUID}.${UUID}`;

    export type ShareDishReference = DishUserReference | ServerDish;

    export type User = {
        uuid: UUID;
        username: string;
        password: string;
        email: string;
        aiGenUsed: string;
    }

    export type SharedDish = {
        userUUID: string | null;
        uuid: string;
        dish: ShareDishReference;
        AIImage: string;
        code: ShareDigits;
        flavors: ShareFlavors;
    }

    export type Dish = {
        uuid: string;
        userUUID: string;
        tracks: ServerFlavorSynthLine[];
        publicshState: "public" | "private";
        created_at: `${number}-${number}-${number} ${number}:${number}:${number}`;
        flavor_count: number;
        creator: string;
        volumes: DishVolumes;
        name: string;
        mainFlavor: MainFlavor;
    }

    export type ServerCustomFlavor = {
        audio: string;
        image: string;
        name: string;
        colors: CustomFlavorColors;
        isPublic: boolean;
        uuid: UUID;
        creator: string | undefined;
    }

    export type CustomFlavorColors = [string, string, string];

}