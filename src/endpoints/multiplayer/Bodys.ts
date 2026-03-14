import { Flavor } from "../../@types/Flavors";
import { DishVolumes, UUID } from "../../@types/User";
import { Multiplayer } from "./MultiplayerEndpoints";

export type MultiplayerSocketBody<E> = {
    type?: E;
    reqId?: number;
}

export type MultiplayerSocketBodyUnknown = MultiplayerSocketBodyInitial |
    MultiplayerSocketBodyAddFlavor |
    MultiplayerSocketBodyAddSynthLine |
    MultiplayerSocketBodyRemoveSynthLine |
    MultiplayerSocketBodyRemoveFlavors |
    MultiplayerSocketBodyChangeVolume |
    MultiplayerSocketBodyChangeTrackVolume |
    MultiplayerSocketBodySelectFlavors |
    MultiplayerSocketBodySelectOnly |
    MultiplayerSocketBodyDeselectFlavors |
    MultiplayerSocketBodyDeselectAllFlavors |
    MultiplayerSocketBodyUpdateFlavors |
    MultiplayerSocketBodyRename |
    MultiplayerSocketBodySave |
    MultiplayerSocketBodyMessage |
    MultiplayerSocketBody<"getDish">;

export type MultiplayerSocketBodyInitial = MultiplayerSocketBody<"initial"> & {
    gameUUID: UUID;
    endpointUUID?: UUID;
};

export type MultiplayerSocketBodyAddFlavor = MultiplayerSocketBody<"addFlavor"> & {
    flavor: Flavor;
    from: number;
    to: number;
    uuid: UUID;
    trackUUID: UUID;
}

export type MultiplayerSocketBodyAddSynthLine = MultiplayerSocketBody<"addSynthLine"> & {
    synthLineUUID: UUID;
}

export type MultiplayerSocketBodyRemoveSynthLine = MultiplayerSocketBody<"removedSynthLine"> & {
    synthLineUUID: UUID;
}

export type MultiplayerSocketBodyRemoveFlavors = MultiplayerSocketBody<"removeFlavors"> & {}

export type MultiplayerSocketBodyChangeVolume = MultiplayerSocketBody<"changeVolume"> & {
    newVolume: number;
    volumeSlot: keyof DishVolumes;
}

export type MultiplayerSocketBodyChangeTrackVolume = MultiplayerSocketBody<"changeTrackVolume"> & {
    trackUUID: UUID;
    newVolume: number;
}

export type MultiplayerSocketBodySelectFlavors = MultiplayerSocketBody<"selectFlavors"> & {
    flavorUUIDs: Multiplayer.SelectedFlavor[];
}

export type MultiplayerSocketBodySelectOnly = MultiplayerSocketBody<"selectOnly"> & {
    flavorUUID: UUID;
}

export type MultiplayerSocketBodyDeselectFlavors = MultiplayerSocketBody<"deselectFlavors"> & {
    flavorUUIDs: Multiplayer.SelectedFlavor[];
}

export type MultiplayerSocketBodyDeselectAllFlavors = MultiplayerSocketBody<"deselectAllFlavors"> & {}

export type MultiplayerSocketBodyUpdateFlavors = MultiplayerSocketBody<"updateFlavors"> & {
    flavors: MovedFlavor[];
}

export type MultiplayerSocketBodyRename = MultiplayerSocketBody<"rename"> & {
    newName: string;
}

export type MultiplayerSocketBodySave = MultiplayerSocketBody<"save"> & {}
export type MultiplayerSocketBodyMessage = MultiplayerSocketBody<"message"> & {
    message: string;
    time: number;
    uuid: UUID;
}

type MovedFlavor = {
    uuid: UUID;
    trackUUID: UUID;
    from: number;
    to: number;
}