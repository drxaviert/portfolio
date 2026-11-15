export type SectionId =
  | "overview"
  | "parameters"
  | "colour"
  | "type"
  | "radius"
  | "shadow"
  | "motion"
  | "components";

export const SECTIONS: readonly { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "parameters", label: "Parameters" },
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "radius", label: "Radius" },
  { id: "shadow", label: "Shadow" },
  { id: "motion", label: "Motion" },
  { id: "components", label: "Components" },
];
