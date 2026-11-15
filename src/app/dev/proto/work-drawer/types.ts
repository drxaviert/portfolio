export type Setup = "featured" | "stack";
export type Variant = "sheet" | "expand" | "side";

/** How the real HomeNav is carried into the expanded reader. */
export type NavMode = "stay" | "float" | "header";

/** Reading layout for the expanded case study. */
export type ContentVariant = "essay" | "margin" | "visual";

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Where the click came from: the card box and its title box. */
export type Origin = {
  card: Rect;
  title: Rect | null;
};
