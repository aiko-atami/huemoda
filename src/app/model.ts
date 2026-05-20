import { sample } from "effector";
import { imageCleared } from "../entities/image";
import { filtersReset } from "../entities/filter-chain";

// Clearing the image also resets the filter chain.
sample({ clock: imageCleared, target: filtersReset });
