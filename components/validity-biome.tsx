"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";

type SceneSignal = CustomEvent<{ stage: number }>;

const forestTrees = Array.from({ length: 23 }, (_, index) => {
  const lane = index % 5;
  return {
    x: -8.8 + lane * 1.45 + Math.sin(index * 2.3) * .35,
    z: -6.5 + Math.floor(index / 5) * 2.55 + Math.cos(index * 1.7) * .4,
    scale: .72 + ((index * 13) % 9) * .055,
  };
});

const derivativeNodes = [
  { x: 2.2, z: -3.8, height: 1.6 },
  { x: 4.5, z: -1.5, height: 2.2 },
  { x: 6.6, z: 1.8, height: 1.45 },
  { x: 3.3, z: 4.4, height: 1.85 },
];

const rootCurves = [
  [[-5.8, .1, -1.4], [-3.2, -.15, -.5], [-.4, -.1, .2], [2.2, .08, -3.8]],
  [[-6.2, .12, 2.1], [-3.4, -.12, 1.7], [.2, -.14, 1.1], [4.5, .1, -1.5]],
  [[-5.3, .1, 4.2], [-2.6, -.2, 3.1], [1.3, -.12, 2.8], [6.6, .08, 1.8]],
  [[-7.1, .1, -.1], [-4.1, -.16, 1.1], [-.2, -.1, 3.7], [3.3, .08, 4.4]],
] as const;

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function Terrain() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(22, 16, 72, 52);
    const positions = plane.attributes.position;
    const colors: number[] = [];
    const forest = new THREE.Color("#173d32");
    const threshold = new THREE.Color("#b58b45");
    const desert = new THREE.Color("#c9754c");
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const side = THREE.MathUtils.smoothstep(x, -2.8, 3.4);
      const forestRelief = Math.sin(x * 1.25) * .12 + Math.cos(y * 1.1) * .16;
      const duneRelief = Math.sin((x + y) * .62) * .42 + Math.cos(y * .47) * .24;
      const fracture = Math.sin(x * 3.1 + y * 1.7) * .035;
      positions.setZ(index, THREE.MathUtils.lerp(forestRelief, duneRelief, side) + fracture);
      const color = side < .52
        ? forest.clone().lerp(threshold, side * 1.7)
        : threshold.clone().lerp(desert, (side - .52) * 2.1);
      colors.push(color.r, color.g, color.b);
    }
    plane.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    plane.computeVertexNormals();
    return plane;
  }, []);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow>
      <meshStandardMaterial vertexColors roughness={.91} metalness={.02} />
    </mesh>
  );
}

function SourceTree({ x, z, scale }: { x: number; z: number; scale: number }) {
  return (
    <group position={[x, .1, z]} scale={scale}>
      <mesh position-y={.74} castShadow>
        <cylinderGeometry args={[.1, .17, 1.5, 7]} />
        <meshStandardMaterial color="#4b3826" roughness={1} />
      </mesh>
      <mesh position={[0, 1.64, 0]} castShadow>
        <icosahedronGeometry args={[.65, 1]} />
        <meshStandardMaterial color="#285c43" roughness={.86} />
      </mesh>
      <mesh position={[-.42, 1.45, .05]} scale={.68} castShadow>
        <icosahedronGeometry args={[.52, 1]} />
        <meshStandardMaterial color="#1c4938" roughness={.9} />
      </mesh>
      <mesh position={[.42, 1.43, -.08]} scale={.78} castShadow>
        <icosahedronGeometry args={[.52, 1]} />
        <meshStandardMaterial color="#39704e" roughness={.9} />
      </mesh>
    </group>
  );
}

function DerivativeField({ stageRef, reduced }: { stageRef: React.MutableRefObject<number>; reduced: boolean }) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  useFrame((_, delta) => {
    const restored = stageRef.current >= 3 ? 1 : .08;
    groups.current.forEach((group, index) => {
      if (!group) return;
      const target = index === 3 && stageRef.current < 4 ? .08 : restored;
      group.scale.y = reduced ? target : THREE.MathUtils.damp(group.scale.y, target, 3.8, delta);
      group.rotation.y = reduced ? 0 : Math.sin(performance.now() * .00035 + index) * .06;
    });
  });

  return derivativeNodes.map((node, index) => (
    <group key={`${node.x}-${node.z}`} ref={(value) => { groups.current[index] = value; }} position={[node.x, .08, node.z]}>
      <mesh position-y={node.height / 2} castShadow>
        <boxGeometry args={[.72, node.height, .72]} />
        <meshStandardMaterial color={index === 3 ? "#5c3b31" : "#76503d"} roughness={.72} />
      </mesh>
      <group position={[0, node.height + .05, 0]}>
        <mesh position-y={.34} castShadow>
          <cylinderGeometry args={[.055, .08, .68, 6]} />
          <meshStandardMaterial color="#485137" roughness={1} />
        </mesh>
        <mesh position-y={.82} castShadow>
          <icosahedronGeometry args={[.34, 1]} />
          <meshStandardMaterial color="#91a84d" roughness={.85} emissive="#31420f" emissiveIntensity={.08} />
        </mesh>
      </group>
    </group>
  ));
}

function RootNetwork({ stageRef, reduced }: { stageRef: React.MutableRefObject<number>; reduced: boolean }) {
  const pulses = useRef<Array<THREE.Mesh | null>>([]);
  const curves = useMemo(() => rootCurves.map((points) => new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  )), []);

  useFrame(({ clock }) => {
    pulses.current.forEach((pulse, index) => {
      if (!pulse) return;
      const curve = curves[index % curves.length];
      const stageBias = Math.max(.12, (stageRef.current + 1) / 5);
      const time = reduced ? stageBias : (clock.elapsedTime * .115 + index * .23) % 1;
      const point = curve.getPoint(Math.min(.995, time));
      pulse.position.copy(point);
      pulse.visible = time <= stageBias + .12;
    });
  });

  return (
    <group>
      {curves.map((curve, index) => (
        <mesh key={`root-${index}`}>
          <tubeGeometry args={[curve, 72, index === 0 ? .045 : .028, 7, false]} />
          <meshStandardMaterial color="#d7b761" emissive="#8a6d25" emissiveIntensity={.65} roughness={.48} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={`pulse-${index}`} ref={(value) => { pulses.current[index] = value; }}>
          <sphereGeometry args={[index % 2 ? .09 : .13, 12, 12]} />
          <meshBasicMaterial color="#edff72" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function AssuranceBoundary({ stageRef, reduced }: { stageRef: React.MutableRefObject<number>; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const targetX = -3.8 + stageRef.current * 1.95;
    group.current.position.x = reduced ? targetX : THREE.MathUtils.damp(group.current.position.x, targetX, 3.4, delta);
    group.current.position.z = Math.sin(stageRef.current * 1.7) * 1.6;
    group.current.rotation.y = reduced ? .25 : .25 + Math.sin(clock.elapsedTime * .42) * .13;
  });

  return (
    <group ref={group} position={[-3.8, 1.8, 0]} rotation={[Math.PI / 2, .25, 0]}>
      {[0, 1, 2].map((ring) => (
        <mesh key={ring} scale={1 + ring * .22}>
          <torusGeometry args={[1.05, .022, 6, 6]} />
          <meshBasicMaterial color={ring === 0 ? "#efff76" : "#d7b761"} transparent opacity={.82 - ring * .2} toneMapped={false} />
        </mesh>
      ))}
      <pointLight color="#efff76" intensity={2.2} distance={5.5} />
    </group>
  );
}

function Atmosphere({ reduced }: { reduced: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const data = new Float32Array(135 * 3);
    for (let index = 0; index < 135; index += 1) {
      const radius = 3 + (index % 17) * .55;
      data[index * 3] = Math.sin(index * 2.17) * radius;
      data[index * 3 + 1] = .45 + (index % 19) * .22;
      data[index * 3 + 2] = Math.cos(index * 1.37) * radius * .62;
    }
    return data;
  }, []);
  useFrame(({ clock }) => {
    if (pointsRef.current && !reduced) pointsRef.current.rotation.y = clock.elapsedTime * .018;
  });
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#d9e6a4" size={.038} transparent opacity={.42} depthWrite={false} />
    </points>
  );
}

function BiomeScene({ reduced }: { reduced: boolean }) {
  const world = useRef<THREE.Group>(null);
  const stageRef = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onStage = (event: Event) => { stageRef.current = (event as SceneSignal).detail.stage; };
    const onPointer = (event: PointerEvent) => {
      pointer.current.x = event.clientX / window.innerWidth - .5;
      pointer.current.y = event.clientY / window.innerHeight - .5;
    };
    window.addEventListener("concord:stage", onStage);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      window.removeEventListener("concord:stage", onStage);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  useFrame(({ camera, clock }, delta) => {
    const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = window.scrollY / range;
    const cameraX = (progress - .5) * 3.2 + pointer.current.x * .8;
    const cameraY = 6.2 - progress * 1.4 - pointer.current.y * .35;
    camera.position.x = reduced ? cameraX : THREE.MathUtils.damp(camera.position.x, cameraX, 2.2, delta);
    camera.position.y = reduced ? cameraY : THREE.MathUtils.damp(camera.position.y, cameraY, 2.2, delta);
    camera.lookAt(0, .25, 0);
    if (world.current) {
      world.current.rotation.y = reduced ? -.08 : -.08 + Math.sin(clock.elapsedTime * .12) * .025;
    }
  });

  return (
    <>
      <color attach="background" args={["#07110e"]} />
      <fog attach="fog" args={["#07110e", 8, 24]} />
      <ambientLight intensity={1.1} color="#c9d7b3" />
      <directionalLight position={[-5, 10, 4]} intensity={2.4} color="#fff1c5" castShadow />
      <directionalLight position={[8, 5, -4]} intensity={1.2} color="#e27a4d" />
      <group ref={world} position={[0, -1.2, 0]}>
        <Terrain />
        {forestTrees.map((tree, index) => <SourceTree key={index} {...tree} />)}
        <DerivativeField stageRef={stageRef} reduced={reduced} />
        <RootNetwork stageRef={stageRef} reduced={reduced} />
        <AssuranceBoundary stageRef={stageRef} reduced={reduced} />
        <Atmosphere reduced={reduced} />
      </group>
    </>
  );
}

function webGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function ValidityBiome() {
  const reduced = useReducedMotionPreference();
  const enabled = useSyncExternalStore(() => () => undefined, webGLAvailable, () => false);
  if (!enabled) return null;

  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [0, 6.2, 11.5], fov: 47, near: .1, far: 42 }}
      dpr={[1, 1.45]}
      frameloop={reduced ? "demand" : "always"}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      shadows={!reduced}
    >
      <BiomeScene reduced={reduced} />
    </Canvas>
  );
}
