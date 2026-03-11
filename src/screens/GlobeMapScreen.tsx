import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { userAreaVisitsApi } from '../services/api';
import { ClimbingArea, Gym } from '../types';
import { GroupsStackParamList, MapStackParamList } from '../types';
import { getAllPolylines } from '../data/worldBorders';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

type AreasMapNav =
  | StackNavigationProp<GroupsStackParamList, 'AreasMap'>
  | StackNavigationProp<MapStackParamList, 'MapMain'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GLOBE_RADIUS = 1.5;
const AUTO_ROTATE_SPEED = 0.0015;
const IDLE_TIMEOUT_MS = 2500;
const CAMERA_DISTANCE_DEFAULT = 4.5;
const CAMERA_DISTANCE_MIN = 1.65; // allow zoom in close (globe radius 1.5 → ~0.15 from surface)
const CAMERA_DISTANCE_MAX = 10;
const OVERLAY_UPDATE_EVERY_N_FRAMES = 1; // update overlay every frame for responsive drag/zoom
// Layout size of the globe view (square)
const GLOBE_VIEW_SIZE = SCREEN_W;
// Extra space around SVG so the native layer doesn't clip graticule/borders when zoomed
const OVERLAY_SVG_PADDING = GLOBE_VIEW_SIZE;
const OVERLAY_SVG_SIZE = GLOBE_VIEW_SIZE + 2 * OVERLAY_SVG_PADDING;

// Convert lat/lng to 3D point on sphere surface (same radius as globe)
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Project a 3D point to 2D screen coordinates
function projectToScreen(
  point: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const projected = point.clone().project(camera);
  // Check if point is on the front hemisphere (visible side)
  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);
  const dotProduct = point.clone().normalize().dot(cameraDir.negate());
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: dotProduct > 0.1,
  };
}

type MapMode = 'areas' | 'gyms';

interface PinItem {
  id: string;
  position: THREE.Vector3;
  hasFriends: boolean;
  area?: ClimbingArea;
  gym?: Gym;
}

const GlobeMapScreen: React.FC = () => {
  const navigation = useNavigation<AreasMapNav>();
  const { user } = useAuth();
  const { climbingAreas, gyms, friends, presence: gymPresence } = useApp();
  const [mapMode, setMapMode] = useState<MapMode>('areas');
  const [areaPresence, setAreaPresence] = useState<{ areaId: string; userId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<ClimbingArea | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);
  const [glReady, setGlReady] = useState(false);

  // Overlay data stored in ref; overlayTick triggers re-render without passing large payload
  const overlayDataRef = useRef<{
    pathD: string;
    positions: Record<string, { x: number; y: number; visible: boolean }>;
  }>({ pathD: '', positions: {} });

  // Three.js refs
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const overlaySegmentsRef = useRef<Array<{ p1: THREE.Vector3; p2: THREE.Vector3 }>>([]);
  const animFrameRef = useRef<number>(0);
  const glViewSize = useRef({ width: 0, height: 0 }); // GL buffer size (pixels)
  const _vec1 = useRef(new THREE.Vector3());
  const _vec2 = useRef(new THREE.Vector3());
  const _vecClip = useRef(new THREE.Vector3()); // for segment–plane clip when one endpoint is behind camera
  const frameCountRef = useRef(0);
  const cameraDistanceRef = useRef(CAMERA_DISTANCE_DEFAULT);

  // Rotation state
  const rotationRef = useRef({ x: 0.3, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const isUserInteractingRef = useRef(false);
  const isPinchingRef = useRef(false);
  const lastInteractionRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const friendsByArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of areaPresence) {
      const list = map.get(p.areaId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.areaId, list);
    }
    return map;
  }, [areaPresence]);

  const friendsByGym = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of gymPresence) {
      if (!p.isActive || !friendIds.has(p.userId)) continue;
      const list = map.get(p.gymId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.gymId, list);
    }
    return map;
  }, [gymPresence, friendIds]);

  const friendName = (userId: string): string => {
    const f = friends.find((x) => x.id === userId);
    return f?.name ?? 'Friend';
  };

  const pinData = useMemo<PinItem[]>(() => {
    if (mapMode === 'areas') {
      return climbingAreas.map((area) => ({
        id: area.id,
        position: latLngToVec3(area.latitude, area.longitude, GLOBE_RADIUS),
        hasFriends: (friendsByArea.get(area.id) ?? []).length > 0,
        area,
      }));
    }
    return gyms
      .filter((g) => typeof g.latitude === 'number' && typeof g.longitude === 'number')
      .map((gym) => ({
        id: gym.id,
        position: latLngToVec3(gym.latitude, gym.longitude, GLOBE_RADIUS),
        hasFriends: (friendsByGym.get(gym.id) ?? []).length > 0,
        gym,
      }));
  }, [mapMode, climbingAreas, gyms, friendsByArea, friendsByGym]);

  const pinDataRef = useRef<PinItem[]>([]);
  pinDataRef.current = pinData;

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    userAreaVisitsApi
      .getFriendsPresenceForUser(user.id)
      .then((data) => {
        if (!cancelled) setAreaPresence(data);
      })
      .catch(() => {
        if (!cancelled) setAreaPresence([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleViewArea = (areaId: string) => {
    setSelectedArea(null);
    setSelectedGym(null);
    (navigation as any).navigate('AreaDetail', { areaId });
  };

  const handleViewGym = (gymId: string) => {
    setSelectedArea(null);
    setSelectedGym(null);
    (navigation as any).navigate('GymDetail', { gymId });
  };

  // Build the Three.js scene
  const onContextCreate = useCallback(async (gl: any) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    glViewSize.current = { width: w, height: h };

    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setClearColor(0x020c18, 1); // opaque dark blue-black so scene is visible
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020c18); // match app background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    cameraRef.current = camera;
    /*
    // Stars background
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 80;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Points(starGeometry, starMaterial));
    */
    // Globe group (for rotation)
    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);
    /*
    // Ocean sphere
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x0a2a4a,
      emissive: 0x051520,
      shininess: 60,
      transparent: true,
      opacity: 0.95,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    globeRef.current = globe;
    globeGroup.add(globe);

    // Atmosphere glow (slightly larger sphere, additive blending)
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.04, 64, 64);
    const atmosMat = new THREE.MeshPhongMaterial({
      color: 0x1a6fa8,
      transparent: true,
      opacity: 0.12,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    globeGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    // Wireframe sphere (fine grid)
    const wireGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.002, 36, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x1e4d7a,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    globeGroup.add(new THREE.Mesh(wireGeo, wireMat));
    */

    // Graticule and borders: built as 3D segment data (coarser = fewer segments = smoother drag)
    const graticuleRadius = GLOBE_RADIUS * 1.003;
    const overlaySegments: Array<{ p1: THREE.Vector3; p2: THREE.Vector3 }> = [];
    const latStep = 60;
    const lngStep = 60;
    const segs = 24;
    for (let lat = -90 + latStep; lat <= 90 - latStep; lat += latStep) {
      for (let i = 0; i < segs; i++) {
        const lng1 = -180 + (360 * i) / segs;
        const lng2 = -180 + (360 * (i + 1)) / segs;
        overlaySegments.push(
          { p1: latLngToVec3(lat, lng1, graticuleRadius), p2: latLngToVec3(lat, lng2, graticuleRadius) }
        );
      }
    }
    for (let lng = -180; lng < 180; lng += lngStep) {
      for (let i = 0; i < segs; i++) {
        const lat1 = -90 + (180 * i) / segs;
        const lat2 = -90 + (180 * (i + 1)) / segs;
        overlaySegments.push(
          { p1: latLngToVec3(lat1, lng, graticuleRadius), p2: latLngToVec3(lat2, lng, graticuleRadius) }
        );
      }
    }
    const borderPolylines = getAllPolylines();
    for (const poly of borderPolylines) {
      for (let i = 0; i < poly.length - 1; i++) {
        const [lng1, lat1] = poly[i];
        const [lng2, lat2] = poly[i + 1];
        if (Math.abs(lng2 - lng1) > 180) continue;
        overlaySegments.push(
          { p1: latLngToVec3(lat1, lng1, graticuleRadius), p2: latLngToVec3(lat2, lng2, graticuleRadius) }
        );
      }
    }
    overlaySegmentsRef.current = overlaySegments;

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, 1.2));
    const sunLight = new THREE.DirectionalLight(0x88aaff, 2.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0x0044aa, 0.8);
    rimLight.position.set(-4, -2, -4);
    scene.add(rimLight);

    // Apply initial rotation
    globeGroup.rotation.x = rotationRef.current.x;
    globeGroup.rotation.y = rotationRef.current.y;

    setGlReady(true);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const timeSinceInteraction = Date.now() - lastInteractionRef.current;
      const isIdle = !isUserInteractingRef.current && timeSinceInteraction > IDLE_TIMEOUT_MS;

      if (isIdle) {
        rotationRef.current.y += AUTO_ROTATE_SPEED;
      } else if (!isUserInteractingRef.current) {
        // Decelerate
        velocityRef.current.x *= 0.92;
        velocityRef.current.y *= 0.92;
        rotationRef.current.x += velocityRef.current.x;
        rotationRef.current.y += velocityRef.current.y;
      }

      // Clamp vertical rotation
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

      // Apply rotation and update world matrix before render
      if (globeGroupRef.current) {
        globeGroupRef.current.rotation.x = rotationRef.current.x;
        globeGroupRef.current.rotation.y = rotationRef.current.y;
        globeGroupRef.current.updateMatrixWorld(true);
      }
      // Zoom: camera distance (pinch-controlled)
      camera.position.set(0, 0, cameraDistanceRef.current);
      camera.lookAt(0, 0, 0);

      // Update overlay *before* render so borders/lines/pins use the same frame as the globe (avoids resize lag)
      frameCountRef.current += 1;
      if (cameraRef.current && globeGroupRef.current && frameCountRef.current % OVERLAY_UPDATE_EVERY_N_FRAMES === 0) {
        const { width: bufW, height: bufH } = glViewSize.current;
        if (bufW > 0 && bufH > 0) {
          const scaleX = OVERLAY_SVG_SIZE / bufW;
          const scaleY = OVERLAY_SVG_SIZE / bufH;
          const rot = globeGroupRef.current.rotation;
          const cam = cameraRef.current!;
          const w1 = _vec1.current;
          const w2 = _vec2.current;

          const pathParts: string[] = [];
          const clip = _vecClip.current;
          for (const { p1, p2 } of overlaySegmentsRef.current) {
            w1.copy(p1).applyEuler(rot);
            w2.copy(p2).applyEuler(rot);
            const a = projectToScreen(w1, cam, bufW, bufH);
            const b = projectToScreen(w2, cam, bufW, bufH);
            const ax = a.x * scaleX;
            const ay = a.y * scaleY;
            const bx = b.x * scaleX;
            const by = b.y * scaleY;
            if (a.visible && b.visible) {
              pathParts.push(`M${ax},${ay} L${bx},${by}`);
            } else if (!a.visible && !b.visible) {
              continue;
            } else {
              const denom = w2.z - w1.z;
              if (Math.abs(denom) < 1e-9) continue;
              const t = -w1.z / denom;
              if (t <= 0 || t >= 1) continue;
              clip.copy(w1).lerp(w2, t);
              const c = projectToScreen(clip, cam, bufW, bufH);
              const cx = c.x * scaleX;
              const cy = c.y * scaleY;
              if (a.visible) {
                pathParts.push(`M${ax},${ay} L${cx},${cy}`);
              } else {
                pathParts.push(`M${cx},${cy} L${bx},${by}`);
              }
            }
          }

          const positions: Record<string, { x: number; y: number; visible: boolean }> = {};
          for (const { id, position } of pinDataRef.current) {
            w1.copy(position).applyEuler(rot);
            const proj = projectToScreen(w1, cam, bufW, bufH);
            positions[id] = {
              x: proj.x * scaleX - OVERLAY_SVG_PADDING,
              y: proj.y * scaleY - OVERLAY_SVG_PADDING,
              visible: proj.visible,
            };
          }

          overlayDataRef.current = { pathD: pathParts.join(' '), positions };
          setOverlayTick((t) => t + 1);
        }
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  }, []); // no deps: GLView calls onContextCreate once; pin data read from pinDataRef each frame

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (pinchEndTimeoutRef.current) clearTimeout(pinchEndTimeoutRef.current);
    };
  }, []);

  // Pan gesture for rotating globe
  const lastPanRef = useRef({ x: 0, y: 0 });
  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      isUserInteractingRef.current = true;
      lastPanRef.current = { x: e.x, y: e.y };
      velocityRef.current = { x: 0, y: 0 };
    })
    .onUpdate((e) => {
      if (isPinchingRef.current) return; // ignore pan deltas while pinch is active (avoids spin on staggered finger lift)
      const dx = e.x - lastPanRef.current.x;
      const dy = e.y - lastPanRef.current.y;
      lastPanRef.current = { x: e.x, y: e.y };
      // Scale sensitivity by camera distance so zoomed-in panning moves smaller distances (less disorienting)
      const baseSensitivity = 0.002;
      const dist = cameraDistanceRef.current;
      const sensitivity = baseSensitivity * (dist / CAMERA_DISTANCE_DEFAULT);
      velocityRef.current = { x: dy * sensitivity, y: dx * sensitivity };
      rotationRef.current.x += dy * sensitivity;
      rotationRef.current.y += dx * sensitivity;
      lastInteractionRef.current = Date.now();
    })
    .onEnd(() => {
      isUserInteractingRef.current = false;
      lastInteractionRef.current = Date.now();
    });

  // Pinch gesture for zoom (camera distance)
  const pinchStartDistanceRef = useRef(CAMERA_DISTANCE_DEFAULT);
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      if (pinchEndTimeoutRef.current) {
        clearTimeout(pinchEndTimeoutRef.current);
        pinchEndTimeoutRef.current = null;
      }
      isPinchingRef.current = true;
      isUserInteractingRef.current = true;
      pinchStartDistanceRef.current = cameraDistanceRef.current;
    })
    .onUpdate((e) => {
      const next = pinchStartDistanceRef.current / e.scale;
      cameraDistanceRef.current = Math.max(
        CAMERA_DISTANCE_MIN,
        Math.min(CAMERA_DISTANCE_MAX, next)
      );
      lastInteractionRef.current = Date.now();
    })
    .onEnd(() => {
      isUserInteractingRef.current = false;
      lastInteractionRef.current = Date.now();
      velocityRef.current = { x: 0, y: 0 }; // prevent deceleration from using stale velocity
      pinchEndTimeoutRef.current = setTimeout(() => {
        pinchEndTimeoutRef.current = null;
        isPinchingRef.current = false;
      }, 100); // debounce so staggered finger lift doesn't feed a pan delta through
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const friendIdsForArea = selectedArea ? (friendsByArea.get(selectedArea.id) ?? []) : [];
  const friendIdsForGym = selectedGym ? (friendsByGym.get(selectedGym.id) ?? []) : [];
  const modalVisible = selectedArea !== null || selectedGym !== null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A9EFF" />
        <Text style={styles.loadingText}>Loading globe...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#00FF41" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {mapMode === 'areas' ? 'CLIMBING AREAS' : 'GYMS'}
          </Text>
          <Text style={styles.headerSub}>
            {mapMode === 'areas'
              ? `${climbingAreas.length} areas worldwide`
              : `${gyms.filter((g) => typeof g.latitude === 'number' && typeof g.longitude === 'number').length} gyms worldwide`}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab: Climbing Areas | Gyms */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mapMode === 'areas' && styles.tabActive]}
          onPress={() => {
            setMapMode('areas');
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          <Text style={[styles.tabText, mapMode === 'areas' && styles.tabTextActive]}>
            Climbing Areas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mapMode === 'gyms' && styles.tabActive]}
          onPress={() => {
            setMapMode('gyms');
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          <Text style={[styles.tabText, mapMode === 'gyms' && styles.tabTextActive]}>
            Gyms
          </Text>
        </TouchableOpacity>
      </View>

      {/* Globe — graticule, borders, and pins drawn as overlay; drag to rotate, pinch to zoom */}
      <View style={styles.globeContainer}>
        <GestureDetector gesture={composedGesture}>
          <View style={styles.glWrap}>
            <GLView
              style={[
                styles.glViewExtended,
                { left: -OVERLAY_SVG_PADDING, top: -OVERLAY_SVG_PADDING, width: OVERLAY_SVG_SIZE, height: OVERLAY_SVG_SIZE },
              ]}
              onContextCreate={onContextCreate}
            />
            {glReady && overlayTick >= 0 && (() => {
              const data = overlayDataRef.current;
              return (
                <View style={[StyleSheet.absoluteFill, { overflow: 'visible' }]} pointerEvents="box-none">
                  <Svg
                    width={OVERLAY_SVG_SIZE}
                    height={OVERLAY_SVG_SIZE}
                    style={{ position: 'absolute', left: -OVERLAY_SVG_PADDING, top: -OVERLAY_SVG_PADDING }}
                  >
                    <Path
                      d={data.pathD}
                      stroke="rgba(18, 205, 43, 0.35)"
                      strokeWidth={1}
                      fill="none"
                    />
                  </Svg>
                  {pinData.map(({ id, hasFriends, area, gym }) => {
                    const pos = data.positions[id];
                    if (!pos || !pos.visible) return null;
                    const pinSize = hasFriends ? 10 : 8;
                    const pinRadius = pinSize / 2;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.pin,
                          {
                            width: pinSize,
                            height: pinSize,
                            borderRadius: pinRadius,
                            left: pos.x - pinRadius,
                            top: pos.y - pinRadius,
                            backgroundColor: hasFriends ? '#00FF41' : '#03A062',
                            shadowColor: hasFriends ? '#00FF41' : '#03A062',
                            ...(hasFriends && {
                              shadowOpacity: 1,
                              shadowRadius: 12,
                              elevation: 10,
                            }),
                          },
                        ]}
                        onPress={() => {
                          if (area) setSelectedArea(area);
                          if (gym) setSelectedGym(gym);
                        }}
                        activeOpacity={0.7}
                      />
                    );
                  })}
                </View>
              );
            })()}
          </View>
        </GestureDetector>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#03A062' }]} />
            <Text style={styles.legendText}>
              {mapMode === 'areas' ? 'Climbing area' : 'Gym'}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00FF41' }]} />
            <Text style={styles.legendText}>Friends here</Text>
          </View>
        </View>

        {/* Hint */}
        <Text style={styles.hint}>Drag to rotate · Pinch to zoom · Auto-rotates when idle</Text>
      </View>

      {/* Detail modal: area or gym */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedArea(null);
          setSelectedGym(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedArea && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedArea.name}
                </Text>
                <Text style={styles.modalLocation}>
                  {[selectedArea.region, selectedArea.country].filter(Boolean).join(', ')}
                </Text>
                {friendIdsForArea.length > 0 ? (
                  <View style={styles.friendsBadge}>
                    <Ionicons name="people" size={14} color="#34C759" />
                    <Text style={styles.friendsBadgeText}>
                      {friendIdsForArea.length === 1
                        ? `${friendName(friendIdsForArea[0])} is here`
                        : `${friendIdsForArea.map(friendName).join(', ')} are here`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noFriends}>No friends at this area right now</Text>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewArea(selectedArea.id)}
                  >
                    <Text style={styles.viewButtonText}>View Area</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedArea(null)}
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {selectedGym && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedGym.name}
                </Text>
                <Text style={styles.modalLocation} numberOfLines={2}>
                  {selectedGym.address || 'Gym'}
                </Text>
                {friendIdsForGym.length > 0 ? (
                  <View style={styles.friendsBadge}>
                    <Ionicons name="people" size={14} color="#34C759" />
                    <Text style={styles.friendsBadgeText}>
                      {friendIdsForGym.length === 1
                        ? `${friendName(friendIdsForGym[0])} is here`
                        : `${friendIdsForGym.map(friendName).join(', ')} are here`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noFriends}>No friends at this gym right now</Text>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewGym(selectedGym.id)}
                  >
                    <Text style={styles.viewButtonText}>View Gym</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedGym(null)}
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020c18',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 160, 98, 0.25)',
    backgroundColor: '#020c18',
    zIndex: 10,
    elevation: 10,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 160, 98, 0.25)',
    backgroundColor: 'transparent',
    zIndex: 10,
    elevation: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(3, 160, 98, 0.4)',
  },
  tabActive: {
    backgroundColor: 'rgba(0, 255, 65, 0.12)',
    borderWidth: 1,
    borderColor: '#00FF41',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(3, 160, 98, 0.9)',
  },
  tabTextActive: {
    color: '#00FF41',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00FF41',
    letterSpacing: 3,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    letterSpacing: 1,
  },
  globeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  glWrap: {
    width: SCREEN_W,
    height: SCREEN_W, // square to keep globe proportional
    position: 'relative',
    overflow: 'visible',
  },
  glViewExtended: {
    position: 'absolute',
  },
  pin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 0,
    borderColor: '#fff',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020c18',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4A9EFF',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#0d1f33',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  modalLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.25)',
  },
  friendsBadgeText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '500',
  },
  noFriends: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#4A9EFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
  },
});

export default GlobeMapScreen;
