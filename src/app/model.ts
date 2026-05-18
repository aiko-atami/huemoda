import { sample } from "effector";
import { imageSelected } from "../entities/image";
import { filtersReset } from "../entities/filter-chain";

// When a new image is loaded, reset the filter chain automatically.
sample({ clock: imageSelected, target: filtersReset });
