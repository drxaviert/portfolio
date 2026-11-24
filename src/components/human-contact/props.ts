import * as THREE from "three";

/**
 * Seven procedural props for /dev/human-contact, built from shared primitives.
 *
 * Every prop is a group of meshes that all reuse the same unit box, unit
 * cylinder, unit sphere and a handful of torus/taper geometries, plus a small
 * set of shared materials. Instances are `clone(true)`d, so forty-odd props
 * share the same GPU buffers and material programs.
 *
 * Each prototype is recentred on its bounding box and scaled so its longest
 * side matches TARGET_SIZE. That keeps a bulb smaller than a laptop while
 * giving the grid a consistent visual weight, and it makes the hover pivot the
 * middle of the silhouette rather than an arbitrary origin.
 */
export type PropKind =
  | "laptop"
  | "headphones"
  | "notebook"
  | "clapperboard"
  | "tin-cans"
  | "bulb"
  | "cup";

export type PropPrototype = {
  kind: PropKind;
  object: THREE.Group;
  width: number;
  height: number;
  depth: number;
  /** Half the diagonal, in world units, for a rotation-safe hover proxy. */
  radius: number;
};

export type PropSet = {
  prototypes: PropPrototype[];
  shadowTexture: THREE.CanvasTexture;
  dispose: () => void;
};

const KINDS: PropKind[] = [
  "laptop",
  "headphones",
  "notebook",
  "clapperboard",
  "tin-cans",
  "bulb",
  "cup",
];

/**
 * Longest side in world units. At 1920x1080 the camera shows roughly 105 units
 * of height, so a 10-unit laptop is ~100 px wide inside a ~240 px grid cell.
 */
const TARGET_SIZE: Record<PropKind, number> = {
  laptop: 10.5,
  headphones: 9,
  notebook: 8.5,
  clapperboard: 8,
  "tin-cans": 10.5,
  bulb: 6.2,
  cup: 7,
};

type Disposable = THREE.BufferGeometry | THREE.Material | THREE.Texture;

function makeShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");

  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 126);

    gradient.addColorStop(0, "rgba(0,0,0,0.62)");
    gradient.addColorStop(0.4, "rgba(0,0,0,0.44)");
    gradient.addColorStop(0.72, "rgba(0,0,0,0.16)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createPropSet(): PropSet {
  const resources = new Set<Disposable>();
  const track = <T extends Disposable>(item: T): T => {
    resources.add(item);
    return item;
  };

  // One draw call per mesh still, but only a handful of distinct buffers.
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = track(new THREE.CylinderGeometry(1, 1, 1, 24));
  const unitDisc = track(new THREE.CylinderGeometry(1, 1, 1, 28));
  const unitSphere = track(new THREE.SphereGeometry(1, 24, 16));
  const bandTorus = track(new THREE.TorusGeometry(5, 0.55, 12, 48, Math.PI));
  const bandInnerTorus = track(
    new THREE.TorusGeometry(5, 0.3, 8, 40, Math.PI * 0.98),
  );
  const canRing = track(new THREE.TorusGeometry(1.9, 0.08, 8, 32));
  const threadRing = track(new THREE.TorusGeometry(1.03, 0.11, 8, 24));
  const lidRing = track(new THREE.TorusGeometry(2.26, 0.1, 8, 32));
  const cupBodyGeometry = track(
    new THREE.CylinderGeometry(2.25, 1.65, 5.8, 28),
  );
  const cupSleeveGeometry = track(
    new THREE.CylinderGeometry(2.16, 1.98, 1.7, 28),
  );
  const bulbNeckGeometry = track(
    new THREE.CylinderGeometry(1.12, 0.78, 1.3, 24),
  );
  const penTipGeometry = track(new THREE.ConeGeometry(0.17, 0.9, 12));

  const matte = track(
    new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.94,
      metalness: 0.04,
    }),
  );
  const matteDark = track(
    new THREE.MeshStandardMaterial({
      color: 0x2e2e2e,
      roughness: 0.96,
      metalness: 0.03,
    }),
  );
  const matteMid = track(
    new THREE.MeshStandardMaterial({
      color: 0x525252,
      roughness: 0.9,
      metalness: 0.06,
    }),
  );
  const matteLight = track(
    new THREE.MeshStandardMaterial({
      color: 0x606060,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );
  const page = track(
    new THREE.MeshStandardMaterial({
      color: 0x5a5a5a,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  const screen = track(
    new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.5,
      metalness: 0.18,
    }),
  );
  const metal = track(
    new THREE.MeshStandardMaterial({
      color: 0x5f5f5f,
      roughness: 0.45,
      metalness: 0.55,
    }),
  );
  const filament = track(
    new THREE.MeshStandardMaterial({
      color: 0x8a7b62,
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x2a2114,
      emissiveIntensity: 1,
    }),
  );
  const glass = track(
    new THREE.MeshStandardMaterial({
      color: 0x8f8f8f,
      roughness: 0.22,
      metalness: 0.3,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const shadowTexture = track(makeShadowTexture());

  function box(
    parent: THREE.Object3D,
    material: THREE.Material,
    width: number,
    height: number,
    depth: number,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(unitBox, material);

    mesh.scale.set(width, height, depth);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);

    return mesh;
  }

  function cylinder(
    parent: THREE.Object3D,
    material: THREE.Material,
    radius: number,
    height: number,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(unitCylinder, material);

    mesh.scale.set(radius, height, radius);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);

    return mesh;
  }

  function disc(
    parent: THREE.Object3D,
    material: THREE.Material,
    radius: number,
    thickness: number,
    x = 0,
    y = 0,
    z = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(unitDisc, material);

    mesh.scale.set(radius, thickness, radius);
    mesh.position.set(x, y, z);
    parent.add(mesh);

    return mesh;
  }

  function ring(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    parent.add(mesh);

    return mesh;
  }

  function laptop(): THREE.Group {
    const group = new THREE.Group();

    box(group, matte, 12, 0.55, 8.4, 0, -3.2, 0);
    box(group, screen, 10.7, 0.08, 4.8, 0, -2.9, -0.55);

    for (let row = 0; row < 4; row += 1) {
      box(group, matteMid, 9.2, 0.1, 0.52, 0, -2.84, -2.55 + row * 0.95);
    }

    box(group, matteMid, 4, 0.09, 2, 0, -2.86, 2.55);

    const lid = new THREE.Group();

    lid.position.set(0, -2.95, -4);
    lid.rotation.x = -0.26;
    group.add(lid);
    box(lid, matte, 12, 7.7, 0.4, 0, 3.85, 0);
    box(lid, screen, 11.1, 6.8, 0.08, 0, 3.95, 0.22);

    cylinder(group, matteMid, 0.22, 11.7, 0, -2.95, -3.95, 0, 0, Math.PI / 2);

    return group;
  }

  function headphones(): THREE.Group {
    const group = new THREE.Group();

    const band = new THREE.Mesh(bandTorus, matte);

    group.add(band);

    const innerBand = new THREE.Mesh(bandInnerTorus, matteDark);

    innerBand.position.z = 0.16;
    group.add(innerBand);

    for (const side of [-1, 1]) {
      box(group, matteMid, 0.55, 2.2, 0.6, side * 4.85, -0.7, 0);

      const cup = new THREE.Group();

      cup.position.set(side * 4.85, -1.55, 0);
      cup.rotation.set(Math.PI / 2, side * 0.26, 0);
      group.add(cup);

      cylinder(cup, matte, 1.9, 1.3);
      disc(cup, matteDark, 1.56, 0.14, 0, 0.7, 0);
      ring(cup, canRing, matteMid, 0, 0.66, 0, Math.PI / 2);
    }

    return group;
  }

  function notebook(): THREE.Group {
    const group = new THREE.Group();

    box(group, matteDark, 10.2, 7.6, 0.5, 0, 0, -0.25, 0, 0, -0.07);
    box(group, page, 9.4, 6.8, 0.3, 0, 0.05, 0.05, 0, 0, -0.07);
    box(group, matte, 0.6, 7.6, 0.6, -4.8, 0, -0.2, 0, 0, -0.07);
    box(group, matteMid, 0.35, 7.7, 0.66, 3.3, 0, -0.2, 0, 0, -0.07);

    const pen = new THREE.Group();

    pen.position.set(1, 0.6, 0.8);
    pen.rotation.z = 0.72;
    group.add(pen);
    cylinder(pen, metal, 0.17, 7);
    const tip = new THREE.Mesh(penTipGeometry, metal);

    tip.position.y = -3.9;
    tip.rotation.z = Math.PI;
    pen.add(tip);
    cylinder(pen, matte, 0.2, 1.5, 0, 3.9, 0);

    return group;
  }

  function clapperboard(): THREE.Group {
    const group = new THREE.Group();

    box(group, matte, 10.6, 6.9, 0.42, 0, -0.9, 0);
    box(group, matteMid, 10, 0.35, 0.5, 0, -3.5, 0.04);
    box(group, matteMid, 10, 0.25, 0.5, 0, -2.95, 0.04);

    const top = new THREE.Group();

    top.position.set(0, 2.9, 0.1);
    top.rotation.z = -0.13;
    group.add(top);
    box(top, matte, 10.9, 1.55, 0.5);
    for (let stripe = 0; stripe < 6; stripe += 1) {
      box(
        top,
        matteLight,
        0.62,
        1.62,
        0.58,
        -4.1 + stripe * 1.64,
        0,
        0.01,
        0,
        0,
        0.55,
      );
    }

    cylinder(group, matteMid, 0.32, 0.9, -4.9, 2.8, 0, Math.PI / 2, 0, 0);
    cylinder(group, matteMid, 0.32, 0.9, 4.9, 2.8, 0, Math.PI / 2, 0, 0);

    return group;
  }

  function tinCans(): THREE.Group {
    const group = new THREE.Group();

    for (const side of [-1, 1]) {
      const can = new THREE.Group();

      can.position.set(side * 5, 0, 0);
      can.rotation.set(Math.PI / 2, side * 0.16, side * 0.08);
      group.add(can);

      cylinder(can, matte, 1.9, 3.2);
      disc(can, matteDark, 1.55, 0.1, 0, 1.62, 0);
      disc(can, matteDark, 1.55, 0.1, 0, -1.62, 0);
      ring(can, canRing, matteMid, 0, -0.85, 0, Math.PI / 2);
      ring(can, canRing, matteMid, 0, 0, 0, Math.PI / 2);
      ring(can, canRing, matteMid, 0, 0.85, 0, Math.PI / 2);
    }

    const stringCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5, -1.8, 0.35),
      new THREE.Vector3(-2.2, -3.15, 0.2),
      new THREE.Vector3(0, -3.55, 0.1),
      new THREE.Vector3(2.2, -3.15, 0.2),
      new THREE.Vector3(5, -1.8, 0.35),
    ]);

    group.add(
      new THREE.Mesh(
        track(new THREE.TubeGeometry(stringCurve, 48, 0.07, 5, false)),
        matteMid,
      ),
    );

    return group;
  }

  function bulb(): THREE.Group {
    const group = new THREE.Group();

    const globe = new THREE.Mesh(unitSphere, glass);

    globe.position.y = 1.4;
    globe.scale.set(2.7, 3, 2.7);
    group.add(globe);

    const neck = new THREE.Mesh(bulbNeckGeometry, matteMid);

    neck.position.y = -1.25;
    group.add(neck);

    cylinder(group, matteMid, 1, 2.4, 0, -2.95, 0);
    ring(group, threadRing, matteMid, 0, -2.1, 0, Math.PI / 2);
    ring(group, threadRing, matteMid, 0, -2.6, 0, Math.PI / 2);
    ring(group, threadRing, matteMid, 0, -3.1, 0, Math.PI / 2);

    cylinder(group, filament, 0.055, 1.8, -0.38, 1.55, 0.12, 0, 0, 0.52);
    cylinder(group, filament, 0.055, 1.8, 0.38, 1.55, 0.12, 0, 0, -0.52);
    cylinder(group, filament, 0.045, 0.7, 0, 2.32, 0.12, 0, 0, Math.PI / 2);

    return group;
  }

  function cup(): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(cupBodyGeometry, matte);

    body.position.y = -1;
    group.add(body);

    const sleeve = new THREE.Mesh(cupSleeveGeometry, matteMid);

    sleeve.position.y = -0.85;
    group.add(sleeve);

    disc(group, matte, 2.32, 0.62, 0, 2.15, 0);
    ring(group, lidRing, matteMid, 0, 1.84, 0, Math.PI / 2);
    box(group, matteLight, 1.1, 0.45, 1.5, 0, 2.58, 0.55);

    return group;
  }

  const builders: Record<PropKind, () => THREE.Group> = {
    laptop,
    headphones,
    notebook,
    clapperboard,
    "tin-cans": tinCans,
    bulb,
    cup,
  };

  const prototypes = KINDS.map((kind): PropPrototype => {
    const content = builders[kind]();
    const box3 = new THREE.Box3().setFromObject(content);
    const size = box3.getSize(new THREE.Vector3());
    const center = box3.getCenter(new THREE.Vector3());

    content.position.sub(center);

    const object = new THREE.Group();

    object.add(content);
    object.scale.setScalar(TARGET_SIZE[kind] / Math.max(size.x, size.y));
    object.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(object);
    const scaled = scaledBox.getSize(new THREE.Vector3());

    return {
      kind,
      object,
      width: scaled.x,
      height: scaled.y,
      depth: scaled.z,
      radius: Math.hypot(scaled.x, scaled.y) / 2,
    };
  });

  return {
    prototypes,
    shadowTexture,
    dispose: () => {
      for (const resource of resources) {
        resource.dispose();
      }

      resources.clear();
    },
  };
}
