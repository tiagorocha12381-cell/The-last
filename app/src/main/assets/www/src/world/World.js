import * as THREE from 'three';
import { Environment } from './Environment.js?v=etapa9';
import { Ground } from './Ground.js';
import { RoadNetwork } from './RoadNetwork.js';
import { Buildings } from './Buildings.js';
import { Props } from './Props.js';
import { CinematicDetails } from './CinematicDetails.js';
import { Districts } from './Districts.js';
import { batchStatics } from '../utils/StaticBatcher.js';

export class World {
  constructor(scene, collisions, assetLoader = null, interactionSystem = null, inventory = null) {
    this.scene = scene;
    this.collisions = collisions;
    this.assetLoader = assetLoader;
    this.interactionSystem = interactionSystem;
    this.inventory = inventory;
    this.group = new THREE.Group();
    this.group.name = 'World';
    this.scene.add(this.group);

    this.environment = new Environment(scene);
    this.ground = new Ground(scene);
    this.roadNetwork = new RoadNetwork(scene, collisions, this);
    this.buildings = new Buildings(scene, collisions, interactionSystem);
    this.props = new Props(scene, collisions, assetLoader, this);
    this.props.interactionSystem = interactionSystem;
    this.props.inventory = inventory;
    this.districts = new Districts(scene, collisions, interactionSystem, inventory);
    // Detalhes cinematográficos usam footprints/calçadas/postes já criados.
    // try/catch: se falhar, o mundo original continua intacto.
    try { this.details = new CinematicDetails(this, scene); }
    catch (e) { console.warn('[World] detalhes cinematográficos indisponíveis:', e); }

    this._addBounds();
  }

  async load(onProgress) {
    if (this.props?.load) await this.props.load(onProgress);
    // Fusão de malhas estáticas (reduz draw calls, especialmente no Android).
    // Feito depois dos veículos GLB para também aproveitar peças repetidas.
    try {
      this.batchStats = batchStatics(this.props.group);
      console.log('[World] batch estático:', JSON.stringify(this.batchStats));
    } catch (e) {
      console.warn('[World] batch estático falhou (mantendo originais):', e);
      this.batchStats = null;
    }
  }

  _addBounds() {
    const s = 145;
    const h = 20;
    const t = 2;
    this.collisions.addBox(new THREE.Vector3(-s - t, 0, -s - t), new THREE.Vector3(s + t, h, -s));
    this.collisions.addBox(new THREE.Vector3(-s - t, 0, s), new THREE.Vector3(s + t, h, s + t));
    this.collisions.addBox(new THREE.Vector3(-s - t, 0, -s), new THREE.Vector3(-s, h, s));
    this.collisions.addBox(new THREE.Vector3(s, 0, -s), new THREE.Vector3(s + t, h, s));
  }

  getSpawnPoint() {
    return new THREE.Vector3(0, 0.18, 10);
  }

  update(dt, playerPosition, camera) {
    this.environment.follow(playerPosition, camera);
    this.props.update?.(dt);
    this.buildings.update?.(dt);
    this.details?.update?.(dt);
    this.districts?.update(playerPosition);
  }
}
