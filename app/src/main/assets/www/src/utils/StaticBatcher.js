import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Fundo de malhas estáticas que compartilham o MESMO material.
 *
 * Objetivo: reduzir draw calls em Android. O cenário cria centenas de
 * pequenas malhas (ervas, folhas, entulho, peças de mobiliário) com
 * poucos materiais repetidos. Fundir cada grupo em uma única malha
 * preserva exatamente a aparência — só muda o número de chamadas.
 *
 * Segurança:
 *  - ignora InstancedMesh, Points, Line, SkinnedMesh e multi-material;
 *  - ignora malhas transparentes (ordenação de transparência);
 *  - ignora árvores animadas (userData.animated) e malhas marcadas;
 *  - se mergeGeometries falhar, mantém as originais;
 *  - não mexe em colisões ( CollisionSystem é independente ).
 */
export function batchStatics(root) {
  const result = { avaliadas: 0, lotes: 0, mescladas: 0, antes: 0, depois: 0, ignoradas: 0 };
  if (!root) return result;

  let antes = 0;
  root.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) antes++; });
  result.antes = antes;

  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();

  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (Array.isArray(o.material)) return;
    const m = o.material;
    if (!m || m.transparent || (m.opacity ?? 1) < 1 || o.userData.noBatch) return;
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    let p = o.parent;
    while (p && p !== root) {
      if (p.userData.animated) return;
      p = p.parent;
    }
    if (!buckets.has(m.uuid)) buckets.set(m.uuid, { mat: m, itens: [] });
    buckets.get(m.uuid).itens.push(o);
    result.avaliadas++;
  });

  const remover = [];
  buckets.forEach(({ mat, itens }) => {
    if (itens.length < 2) return;
    const geoms = [];
    const ok = [];
    // aplica a transformação de cada malha em coordenadas locais de root
    for (const o of itens) {
      try {
        const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const g = o.geometry.clone();
        g.applyMatrix4(rel);
        geoms.push(g);
        ok.push(o);
      } catch (e) { result.ignoradas++; }
    }
    if (geoms.length < 2) { geoms.forEach(g => g.dispose()); return; }
    let merged = null;
    try { merged = mergeGeometries(geoms, false); }
    catch (e) { result.ignoradas++; }
    geoms.forEach(g => g.dispose());
    if (!merged) return;

    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = ok[0].castShadow;
    mesh.receiveShadow = ok[0].receiveShadow;
    mesh.frustumCulled = true;
    mesh.name = 'BATCH_' + (mat.name || mat.uuid.slice(0, 8));
    root.add(mesh);
    ok.forEach(o => remover.push(o));
    result.lotes++;
    result.mescladas += ok.length;
  });

  remover.forEach(o => { if (o.parent) o.parent.remove(o); });

  let depois = 0;
  root.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) depois++; });
  result.depois = depois;
  return result;
}
