/*=== Funzioni per la gestione dell'overlay (la schermata di presentazione del progetto) ===*/
function chiudi() {
    
    // Nascondi overlay
    const overlay = document.getElementById("attenzione-overlay");
    if (overlay) {
        overlay.style.display = "none";
    };
}


/*============= INIZIALIZZAZIONE CONTESTO WEBGL ======================*/
var canvas = document.getElementById("my-canvas");
var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
if (!gl) {
  alert("WebGL non disponibile");
  throw new Error("WebGL non disponibile");
}

//NOTE -  gli shader per la navicella e la fiamma sono in un programma, mentre lo skybox ha
// un programma dedicato per ottimizzare le prestazioni e semplificare la gestione delle uniformi specifiche dello skybox.

// Shader Program info separati:
var programInfo = null; // Per Navicella e Fiamma
var skyboxProgramInfo = null; // Per lo Skybox

// Buffer Info oggetti
var NavicellaBufferInfo = null; // Navicella
var flameBufferInfo = null; // Fiamma
var skyboxBufferInfo = null; // Lo skybox utilizza un buffer dedicato per la geometria del cubo
var skyboxReady = false; // Flag per indicare quando lo skybox è pronto per essere disegnato

var diffuseTexture = null; // Texture principale per la navicella (caricata dal file .mtl)
var whiteTexture = null; // Texture bianca di fallback per oggetti senza UV

// Stati e variabili fisiche
var animationStarted = false; // Flag per indicare se l'animazione è iniziata (usato per il camera lag)
var flightRotation = 0; // Rotazione attuale della navicella su asse Y (in radianti)
var spaceshipTranslation = { x: 0, y: 0, z: 20}; // Posizione iniziale della navicella (partenza con z positiva per vedere meglio lo skybox)
var velocityZ = 0; // Velocità attuale lungo l'asse Z (direzione di volo)
var startZ = 0; // Posizione Z di partenza (usata per calcolare l'altezza massima raggiunta)
var maxZReached = 0; // Altezza massima raggiunta durante il volo (usata per aggiornare l'indicatore di altezza massima)
var minZReached = 0; // Altezza minima raggiunta durante il volo (usata per aggiornare l'indicatore di altezza minima)

var moveState = { left: false, right: false }; // Stato dei comandi di movimento (per sinistra/destra)
var thrustState = { active: false, startTime: 0, holdTime: 0 }; // Stato del propulsore (attivo o meno, tempo di attivazione e durata del hold)

//NOTE - le variabili relative alla fiamma sono separate per permettere un controllo più preciso dell'effetto visivo, come flickering e la scala variabile in base alla potenza del propulsore.
// Variabili per la gestione della fiamma del propulsore:
var flameElement = null; //tanto sono le stesse variabili che usa la navicella, non c'è bisogno di creare un oggetto dedicato per la fiamma, basta aggiornare la posizione e la scala della geometria della fiamma in base alla posizione e alla potenza del propulsore.
var startPointElement = null;
var finishPointElement = null;
var highestPointElement = null;
var lowestPointElement = null;
var flameOffset = { x: 0, y: -1, z: -0.1}; // Posizione della fiamma rispetto alla navicella (leggermente dietro e sotto il centro, per correggere l'effetto visivo)
var flameObjectScale = 0; // Scala della geometria della fiamma (0 quando il propulsore è spento, aumenta gradualmente quando attivo, e diminuisce quando rilasciato per creare un effetto di accensione/spegnimento più fluido)
var mouseControlEnabled = false; // Flag per abilitare il controllo tramite mouse (disabilitato all'inizio per evitare movimenti improvvisi quando si muove il mouse prima di iniziare l'animazione)
var mouseXNormalized = 0;

// Matrici di trasformazione geometrica
var projectionMatrix = m4.identity(); // Matrice di proiezione prospettica
var viewMatrix = m4.identity(); // Matrice di vista (camera)
var viewProjectionMatrix = m4.identity(); // Matrice combinata di vista e proiezione (calcolata ogni frame)
var worldViewProjectionMatrix = m4.identity(); // Matrice combinata di mondo, vista e proiezione (calcolata ogni frame per la navicella)
var worldInverseTransposeMatrix = m4.identity(); // Matrice inversa trasposta del mondo (calcolata ogni frame per le luci e le normali)

// Variabili per il controllo della telecamera e dell'effetto di inseguimento (camera lag)
var followCamera = true; // Flag per abilitare/disabilitare l'inseguimento della telecamera (camera lag)
var isBarrelRolling = false; // Flag per indicare se l'avvitamento è attivo
var barrelRollAngle = 0; // Angolo di rotazione per l'avvitamento (in radianti)
var barrelRollSpeed = 0.2; // Velocità di rotazione per l'avvitamento (più alto = rotazione più veloce)
var skyboxRotation = 0; // Angolo di rotazione dello skybox (in radianti) per creare un effetto di rotazione indipendente durante l'avvitamento
var cubeSize = 4; // Dimensione del cubo dello skybox (usata per calcolare la posizione minima della navicella e evitare che vada sotto il pavimento dello skybox)
var floorZ = -cubeSize / 2; //

// --- VARIABILI SUPPORTO PER CAMERA LAG ---
var currentCameraPos = [0, -6, 2]; // Posizione iniziale della telecamera
var currentCameraTarget = [0, 0, 20]; // Punto iniziale in cui la telecamera guarda
// // --- CONTROLLO VISUALE A 360 GRADI (STILE SKYBOX INTERATTIVO) ---
var teta = Math.PI / 1.2; // Angolo di rotazione orizzontale (inizialmente guarda verso il basso)
var fi = Math.PI / 2;   // Angolo di inclinazione verticale
var drag = false; // Flag per indicare se ho un trascinato (usato per il controllo della visuale)
var old_x, old_y; // Vecchie coordinate del mouse (usate per calcolare la differenza di movimento)

// Posizione minima della navicella per evitare che vada sotto il pavimento dello skybox:
if (spaceshipTranslation.z < floorZ) {
  spaceshipTranslation.z = floorZ;
  velocityZ = 0;
}
// Posizione minima della navicella per evitare che vada sotto il pavimento dello skybox
spaceshipTranslation.z = floorZ + 0.1;

// Mappatura delle facce dello Skybox
var skyboxImages = ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"];
var showSkeleton = false; // Flag per mostrare/nascondere lo scheletro wireframe della navicella
var showSkybox = true; // Flag per mostrare/nascondere lo skybox
var lightEnabled = true; // Flag per attivare/disattivare la luce direzionale
var controlsPanelOpen = true; // Flag per indicare se il pannello dei controlli è aperto o nascosto
var skeletonBufferInfo = null; // Buffer info per lo scheletro wireframe della navicella
var skyboxSets = {
  default: ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"], // skybox 1 (predefinita)
  second: ["px(1).png", "nx(1).png", "py(1).png", "ny(1).png", "pz(1).png", "nz(1).png"], // skybox 2
  third: ["px(2).png", "nx(2).png", "py(2).png", "ny(2).png", "pz(2).png", "nz(2).png"], // skybox 3
  fourth: ["px(3).png", "nx(3).png", "py(3).png", "ny(3).png", "pz(3).png", "nz(3).png"], // skybox 4
};
var currentSkyboxSet = "default";

/*=================== GEOMETRIA SKYBOX =================== */
function initSkyboxGeometry() {
  var skyboxVertices = [
    -1, -1, -1,
    1, -1, -1,
    1, 1, -1,
    -1, 1, -1,
    -1, -1, 1,
    1, -1, 1,
    1, 1, 1,
    -1, 1, 1,
  ];

  var skyboxIndices = [
    0, 1, 2,
    0, 2, 3,
    4, 5, 6,
    4, 6, 7,
    0, 4, 7,
    0, 7, 3,
    1, 5, 6,
    1, 6, 2,
    3, 2, 6,
    3, 6, 7,
    0, 1, 5,
    0, 5, 4,
  ];

  // Creazione del buffer per la geometria dello skybox (un cubo unitario centrato nell'origine)
  skyboxBufferInfo = webglUtils.createBufferInfoFromArrays(gl, {
    position: { numComponents: 3, data: skyboxVertices },
    indices: skyboxIndices,
  });
}

/*=================== GESTIONE TEXTURE =================== */
//NOTE - 'loadCubemap' è stata progettata per caricare in modo robusto e flessibile una cubemap da un array di URL,
// gestendo sia percorsi relativi che assoluti, e supportando URL remoti con Cross-Origin Resource Sharing (CORS) quando necessario.
// La funzione imposta parametri di default per la texture cubemap fino a quando le immagini non sono
// caricate, e aggiorna un flag di ready per indicare quando lo skybox è pronto per essere disegnato.
// Inoltre, gestisce eventuali errori di caricamento delle immagini mostrando un messaggio di errore nella console.  
function loadCubemap(urls) {
  skyboxReady = false;
  cubemapTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);

  
  var faces = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
  ];

  // Impostazione di parametri di default per la texture cubemap (fino a quando le immagini non sono caricate)
  applyTextureParameters(gl.TEXTURE_CUBE_MAP, defaultTextureParameters);

  // Caricamento asincrono delle 6 immagini della cubemap
  var loadedCount = 0;
  //questo ciclo permette di caricare tutte le 6 immagini della cubemap in modo asincrono, e una volta che tutte le immagini sono state caricate,
  // imposta il flag 'skyboxReady' a true per indicare che lo skybox è pronto per essere disegnato.
  // Inoltre, gestisce eventuali errori di caricamento delle immagini mostrando il messaggio di errore nella console.
    for (var i = 0; i < 6; i++) {
    let face = faces[i];
    let image = new Image();
    var src = normalizeTextureUrl(urls[i]);
    // Abilita crossOrigin solo per URL remoti
    if (/^https?:\/\//i.test(src) || src.indexOf('://') !== -1) {
      image.crossOrigin = "anonymous";
    }
    console.log("loadCubemap:", src);
    image.onload = function () {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      // Verifica se tutte le immagini sono state caricate per impostare il flag di ready dello skybox
      loadedCount++;
      if (loadedCount === 6) {
        skyboxReady = true;
        console.log('SKYBOX COMPLETATO');
      }
    };
    // Gestione degli errori di caricamento delle immagini della cubemap
    image.onerror = function() {
      console.error("Errore fatale: Impossibile caricare il file ", src);
    };
    // Usa la funzione di normalizzazione conservativa per robustezza (trim + replace backslash)
    image.src = src;
  }
}

// NOTE - Parametri di default per tutte le texture create dal progetto.
var defaultTextureParameters = {
  minFilter: gl.LINEAR,
  magFilter: gl.LINEAR,
  wrapS: gl.CLAMP_TO_EDGE,
  wrapT: gl.CLAMP_TO_EDGE,
};

function applyTextureParameters(target, params) {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, params.minFilter);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, params.magFilter);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, params.wrapS);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, params.wrapT);
}

//NOTE - 'normalizeTextureUrl' è stata progettata per poter gestire in modo robusto e flessibile una varietà di formati di URL per le texture,
// evitando troncamenti o modifiche che potrebbero invalidare percorsi relativi, assoluti o URL remoti funzionanti. Si limita a rimuovere spazi superflui e a sostituire i backslash con slash, mantenendo intatta la struttura dell'URL originale.
function normalizeTextureUrl(url) {
  if (!url) return url;
  var s = url.trim().replace(/\\/g, "/");
  // Mantieni intatti data: e URL remoti
  if (/^data:/i.test(s) || /^https?:\/\//i.test(s)) return s;
  // Mantieni percorsi relativi espliciti
  if (s.indexOf("../") === 0 || s.indexOf("./") === 0) return s;
  // Rimuovi eventuale file://
  s = s.replace(/^file:\/\//i, "");
  // Se è un percorso Windows assoluto (C:/...) o contiene slash, prendi solo il basename
  if (/^[a-zA-Z]:\//.test(s) || s.indexOf('/') !== -1) {
    var name = s.substring(s.lastIndexOf('/') + 1);
    return './' + name;
  }
  // Se è già un nome semplice, risolvilo nella cartella corrente
  return './' + s;
}

//NOTE - 'createSolidTexture' è stata aggiunta per creare una texture monocolore di fallback
// (bianca) da utilizzare quando un materiale non ha una texture associata, o quando si vuole forzare un
// colore uniforme. Questa funzione crea una texture 1x1 con il colore specificato, e imposta i parametri
// di filtraggio e wrapping in modo appropriato per garantire che venga visualizzata correttamente anche su
// superfici senza UV.
function createSolidTexture(color) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color));
  applyTextureParameters(gl.TEXTURE_2D, defaultTextureParameters);
  return texture;
}

//NOTE - 'loadTexture' fa lo stesso lavoro di 'createSolidTexture' per creare una texture di
// default (bianca) da utilizzare come placeholder fino a quando l'immagine non è caricata, inoltre
// gestisce il caricamento asincrono di un'immagine da un URL specificato. Imposta i parametri di filtraggio e wrapping in modo appropriato, e aggiorna la texture con l'immagine una volta che è stata caricata, permettendo di visualizzare correttamente la texture anche su superfici senza UV.
function loadTexture(url) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  applyTextureParameters(gl.TEXTURE_2D, defaultTextureParameters);
  var image = new Image();
  var src = normalizeTextureUrl(url);
  // Abilita crossOrigin solo per URL remoti per ridurre problemi con file locali
  if (/^https?:\/\//i.test(src) || src.indexOf('://') !== -1) {
    image.crossOrigin = "anonymous";
  }
  console.log("loadTexture:", src);
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  };
  image.onerror = function () {
    console.error("Errore caricamento texture:", src);
  };
  image.src = src;
  return texture;
}

/*=================== GENERAZIONE DEGLI SHADER =================== */
//!SECTION - Gli shader per la navicella e la fiamma sono combinati in un unico programma per
// ottimizzare le prestazioni, mentre lo skybox ha un programma dedicato per semplificare la gestione
// delle uniformi specifiche dello skybox e migliorare le prestazioni durante il rendering dello skybox.

// 'createPrograms' definisce gli shader per la navicella e la fiamma, e carica gli shader per lo skybox dal DOM. Crea i programmi WebGL corrispondenti e prepara una texture bianca di fallback.
function createPrograms() {

  var spaceshipVertexShader = [
    //attributi per la navicella e la fiamma
    "attribute vec4 a_position;", // Posizione del vertice
    "attribute vec3 a_normal;", // Normale
    "attribute vec4 a_color;", // Colore
    "attribute vec4 a_emissive;", // Luce emessa dalla fiamma
    "attribute vec2 a_texcoord;", // Coordinate UV
    //uniforms per la navicella e la fiamma
    "uniform mat4 u_worldViewProjection;", //marice di proiezione vista mondo
    "uniform mat4 u_worldInverseTranspose;",
    "uniform mat4 u_world;", //matrice di trasformazione del mondo (usata per calcolare la posizione del vertice nello spazio del mondo)
    //variabili varyings per passare dati dal vertex shader al fragment shader
    "varying vec3 v_normal;",
    "varying vec3 v_surfacePosition;",
    "varying vec4 v_color;",
    "varying vec4 v_emissive;",
    "varying vec2 v_texcoord;",
    // Corpo principale del vertex shader
    "void main() {",
    "  gl_Position = u_worldViewProjection * a_position;",
    "  v_normal = mat3(u_worldInverseTranspose) * a_normal;",
    "  v_surfacePosition = (u_world * a_position).xyz;",
    "  v_color = a_color;",
    "  v_emissive = a_emissive;",
    "  v_texcoord = a_texcoord;",
    "}",
  ].join("\n");

  var spaceshipFragmentShader = [
    "precision mediump float;",
    "varying vec3 v_normal;",
    "varying vec3 v_surfacePosition;",
    "varying vec4 v_color;",
    "varying vec4 v_emissive;",
    "varying vec2 v_texcoord;",
    "uniform sampler2D u_diffuse;",
    "uniform vec3 u_lightWorldPosition;",
    "uniform vec3 u_lightColor;",
    "uniform vec3 u_ambientColor;",
    "void main() {",
    "  vec3 normal = normalize(v_normal);",
    "  vec3 surfaceToLight = normalize(u_lightWorldPosition - v_surfacePosition);",
    "  float diffuseFactor = max(dot(normal, surfaceToLight), 0.0);",
    "  vec3 ambient = u_ambientColor * v_color.rgb;",
    "  vec3 diffuse = diffuseFactor * u_lightColor * v_color.rgb;",
    "  vec3 emissive = v_emissive.rgb * v_emissive.a;",
    "  vec4 diffuseColor = texture2D(u_diffuse, v_texcoord);",
    "  vec3 color = (ambient + diffuse + emissive) * diffuseColor.rgb;",
    "  gl_FragColor = vec4(color, diffuseColor.a * v_color.a);",
    "}",
  ].join("\n");

  // Creazione del programma per la navicella e la fiamma 
  programInfo = webglUtils.createProgramInfo(gl, [spaceshipVertexShader, spaceshipFragmentShader]);

  // Caricamento degli shader per lo skybox dal Document Object Model (DOM)
  var skyboxVS = document.getElementById("skybox-vertex").text;
  var skyboxFS = document.getElementById("skybox-fragment").text;

  // Creazione del programma per lo skybox
  skyboxProgramInfo = webglUtils.createProgramInfo(gl, [skyboxVS, skyboxFS]);
  whiteTexture = createSolidTexture([255, 255, 255, 255]);
  diffuseTexture = whiteTexture;
}

// 'resizeCanvas' ridimensiona il canvas in base alle dimensioni del display
function resizeCanvas() {
  webglUtils.resizeCanvasToDisplaySize(canvas, window.devicePixelRatio);
  gl.viewport(0, 0, canvas.width, canvas.height);
  updateProjection();
}

/*=================== GESTIONE CAMERA E PROIEZIONE =================== */
function updateProjection() {
  m4.perspective((60 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100.0, projectionMatrix);

  // fi= angolo polare (inclinazione verticale), teta= angolo azimutale (rotazione orizzontale)
  var targetXDirection = Math.sin(fi) * Math.cos(teta);
  var targetYDirection = Math.sin(fi) * Math.sin(teta);
  var targetZDirection = Math.cos(fi);

  // Nota: Moltiplichiamo la direzione invertita per distanziarci dalla navicella
  var distanceBehind = 6; 
  var cameraTargetPos = [
    spaceshipTranslation.x - targetXDirection * distanceBehind,
    spaceshipTranslation.y - targetYDirection * distanceBehind,
    spaceshipTranslation.z - targetZDirection * distanceBehind + 1.5 // leggermente sollevata
  ];

  // Punto esatto in cui guarda la telecamera (le coordinate della navicella)
  var targetLookAt = [spaceshipTranslation.x, spaceshipTranslation.y, spaceshipTranslation.z];

  if (!animationStarted) {
    // All'inizio, posizioniamo la telecamera direttamente dietro la navicella senza interpolazione per evitare movimenti improvvisi quando si muove il mouse prima di iniziare l'animazione.
    currentCameraPos = [cameraTargetPos[0], cameraTargetPos[1], cameraTargetPos[2]];
    currentCameraTarget = [targetLookAt[0], targetLookAt[1], targetLookAt[2]];
  } else {
    // Dopo l'inizio dell'animazione, la telecamera insegue la navicella lentamente
    currentCameraPos[0] += (cameraTargetPos[0] - currentCameraPos[0]) * 0.08; 
    currentCameraPos[1] += (cameraTargetPos[1] - currentCameraPos[1]) * 0.08;
    currentCameraPos[2] += (cameraTargetPos[2] - currentCameraPos[2]) * 0.08;

    currentCameraTarget[0] += (targetLookAt[0] - currentCameraTarget[0]) * 0.08;
    currentCameraTarget[1] += (targetLookAt[1] - currentCameraTarget[1]) * 0.08;
    currentCameraTarget[2] += (targetLookAt[2] - currentCameraTarget[2]) * 0.08;
  }
  //direzione del sistema di coordinate della telecamera:
  var upVector = [0, 0, 1]; // Asse Z orientato verso l'alto
  var cameraMatrix = m4.lookAt(currentCameraPos, currentCameraTarget, upVector);
  m4.inverse(cameraMatrix, viewMatrix); // Calcola la matrice di vista (inversa della matrice della telecamera)
  m4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix); // Aggiorna la matrice combinata di vista e proiezione
}

/*=================== RENDERING LOOP =================== */
function drawScene() {
  resizeCanvas();

  // Impostazioni di base per il rendering
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0.1, 1); 
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // Pulisce sia il buffer del colore che quello della profondità per preparare la scena al nuovo frame

  // --- DISEGNO DELLO SKYBOX ---
  if (skyboxReady && skyboxBufferInfo && skyboxProgramInfo && cubemapTexture) {
    gl.depthMask(false); // Disabilita la scrittura nel depth buffer per disegnare lo skybox sempre dietro a tutto il resto
    gl.disable(gl.CULL_FACE); // Disabilita il backface culling
    gl.useProgram(skyboxProgramInfo.program); // Attiva il programma shader dello skybox

    // Copio la matrice di vista senza traslazione per avere uno skybox 'infinito' e non influenzato dalla posizione della navicella
    var viewMatrixCopy = m4.copy(viewMatrix);
    //NB - La matrice di vista è organizzata in colonne
    // [0] [1] [2] [3] per la prima colonna, indicano la direzione dell'asse X della telecamera (destra)
    // [4] [5] [6] [7] per la seconda colonna, indicano la direzione dell'asse Y della telecamera (su)
    // [8] [9] [10] [11] per la terza colonna, indicano la direzione dell'asse Z della telecamera (avanti)
    // [12] [13] [14] [15] per la quarta colonna, indicano la posizione della telecamera (traslazione) mentre [15] è sempre 1 per le matrici di trasformazione omogenee.

    viewMatrixCopy[12] = 0;
    viewMatrixCopy[13] = 0;
    viewMatrixCopy[14] = 0;
    
    m4.zRotate(viewMatrixCopy, skyboxRotation, viewMatrixCopy);//rotazione dello skybox durante l'avvitamento
    var skyboxViewProjection = m4.multiply(projectionMatrix, viewMatrixCopy); // Calcola la matrice combinata di vista e proiezione per lo skybox

    webglUtils.setBuffersAndAttributes(gl, skyboxProgramInfo.attribSetters, skyboxBufferInfo);
    webglUtils.setUniforms(skyboxProgramInfo.uniformSetters, {
      u_viewDirectionProjectionInverse: skyboxViewProjection,
      u_skybox: cubemapTexture, 
    });
    // Disegna la skybox sempre dietro a tutto il resto
    webglUtils.drawBufferInfo(gl, skyboxBufferInfo);
    gl.depthMask(true);
  }

  // --- DISEGNO DELLA NAVICELLA ---
  if (NavicellaBufferInfo && programInfo) {
    var worldMatrix = m4.identity();
    m4.translate(worldMatrix, spaceshipTranslation.x, spaceshipTranslation.y, spaceshipTranslation.z, worldMatrix);
    
    
    //avvitamento!!!
    if (isBarrelRolling) {
      m4.yRotate(worldMatrix, barrelRollAngle, worldMatrix);
    }

    m4.yRotate(worldMatrix, flightRotation, worldMatrix); // Rotazione rispetto Y
    m4.multiply(viewProjectionMatrix, worldMatrix, worldViewProjectionMatrix); // conversione coordinati del mondo in coordinate schermo
    m4.inverse(worldMatrix, worldInverseTransposeMatrix); // per preservare le normali durante le trasformazioni
    m4.transpose(worldInverseTransposeMatrix, worldInverseTransposeMatrix); //...e per correggere l'orientamento delle normali dopo l'inversione

    gl.useProgram(programInfo.program); // Rimando allo shader le matrici di trasformazione e le informazioni sulle luci per la navicella e la fiamma
    webglUtils.setBuffersAndAttributes(gl, programInfo.attribSetters, NavicellaBufferInfo);

    //NOTE - Le uniformi per la navicella e la fiamma sono gestite insieme
    webglUtils.setUniforms(programInfo.uniformSetters, {
      u_worldViewProjection: worldViewProjectionMatrix,
      u_worldInverseTranspose: worldInverseTransposeMatrix,
      u_world: worldMatrix,
        u_lightWorldPosition: [5.0, 8.0, 10.0],
        u_lightColor: lightEnabled ? [1.0, 1.0, 0.9] : [0.0, 0.0, 0.0], // Luce direzionale bianca calda (se abilitata) o spenta (se disabilitata)
      u_ambientColor: [0.3, 0.3, 0.7], // Luce ambientale leggermente blu per dare un po' di colore alla scena anche nelle ombre
      u_diffuse: diffuseTexture || whiteTexture,
    });

    // Disegna la navicella
    webglUtils.drawBufferInfo(gl, NavicellaBufferInfo);

    if (showSkeleton && skeletonBufferInfo) {
      //uso webgl-utils.js per disegnare lo scheletro wireframe della navicella, usando lo stesso programma shader della navicella per condividere le uniformi di trasformazione e illuminazione, ma con un colore di luce diverso (più brillante) per far risaltare lo scheletro rispetto alla superficie texturizzata della navicella.
      webglUtils.setBuffersAndAttributes(gl, programInfo.attribSetters, skeletonBufferInfo);
      webglUtils.setUniforms(programInfo.uniformSetters, {
        u_worldViewProjection: worldViewProjectionMatrix,
        u_worldInverseTranspose: worldInverseTransposeMatrix,
        u_lightWorldPosition: [spaceshipTranslation.x, spaceshipTranslation.y, spaceshipTranslation.z],
        u_lightColor: lightEnabled ? [0.7, 0.95, 1.0] : [0.0, 0.0, 0.0],
        u_ambientColor: [0.7, 0.7, 0.8],
        u_diffuse: whiteTexture,
      });
      gl.enable(gl.BLEND);
      gl.lineWidth(1.5);
      webglUtils.drawBufferInfo(gl, skeletonBufferInfo, gl.LINES);
      gl.disable(gl.BLEND);
    }
  }

  // --- DISEGNO DELLA FIAMMA ---
  if (flameBufferInfo && programInfo && flameObjectScale > 0) {
    var flameWorldMatrix = m4.copy(worldMatrix);
    m4.translate(flameWorldMatrix, flameOffset.x, flameOffset.y, flameOffset.z, flameWorldMatrix);
    
    // --- FLICKERING DELLA FIAMMA ---

    var flickeringScale = flameObjectScale * (1.0 + Math.sin(performance.now() * 0.08) * 0.06); //oscillazione della scala + fattore sin(tempo) per una leggera vibrazione
    m4.scale(flameWorldMatrix, flickeringScale, flickeringScale, flickeringScale, flameWorldMatrix);
    var flameWorldViewProjectionMatrix = m4.identity();
    var flameWorldInverseTransposeMatrix = m4.identity();
    m4.multiply(viewProjectionMatrix, flameWorldMatrix, flameWorldViewProjectionMatrix);
    m4.inverse(flameWorldMatrix, flameWorldInverseTransposeMatrix);
    m4.transpose(flameWorldInverseTransposeMatrix, flameWorldInverseTransposeMatrix);

    webglUtils.setBuffersAndAttributes(gl, programInfo.attribSetters, flameBufferInfo);
    webglUtils.setUniforms(programInfo.uniformSetters, {
      u_worldViewProjection: flameWorldViewProjectionMatrix,
      u_worldInverseTranspose: flameWorldInverseTransposeMatrix,
      u_lightWorldPosition: [spaceshipTranslation.x, spaceshipTranslation.y, spaceshipTranslation.z],
      u_lightColor: lightEnabled ? [1.0, 0.5, 0.0] : [0.0, 0.0, 0.0],
      u_ambientColor: [0.5, 0.5, 0.5],
      u_diffuse: whiteTexture,
    });

    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    webglUtils.drawBufferInfo(gl, flameBufferInfo);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

/*=================== GESTIONE LOGICA E FILE OBJ =================== */
function onCanvasMouseMove(event) {
  var rect = canvas.getBoundingClientRect();
  var x = event.clientX - rect.left;
  mouseXNormalized = (x / rect.width) * 2 - 1;
  if (mouseXNormalized < -1) mouseXNormalized = -1;
  if (mouseXNormalized > 1) mouseXNormalized = 1;
  mouseControlEnabled = true;
}

function loadOBJFile(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) throw new Error("Impossibile caricare " + url);
    return response.text();
  });
}

function createBuffersFromMesh(mesh) {
  var positions = [], normals = [], colors = [], emissives = [], texcoords = [];
  var defaultKdColor = [0.8, 0.9, 1.0, 1.0]; 
  
  for (var i = 1; i <= mesh.nface; i++) {
    var face = mesh.face[i];
    var faceNormal = mesh.facetnorms[i] || { i: 0, j: 0, k: 1 };
    var faceColor = defaultKdColor; 

    if (face.material !== undefined && mesh.materials && mesh.materials[face.material]) {
      var mat = mesh.materials[face.material];
      if (mat.parameter && mat.parameter.has('map_Kd') && !mat.texture) {
        var mapKd = mat.parameter.get('map_Kd');
        if (typeof mapKd === 'string') {
          mat.texture = loadTexture(mapKd);
          diffuseTexture = mat.texture;
        }
      }
      if (mat.parameter && mat.parameter.has('Kd')) {
        var kd = mat.parameter.get('Kd'); 
        faceColor = [kd[0], kd[1], kd[2], 1.0]; 
      }
    }

    for (var j = 0; j < face.n_v_e; j++) {
      var vertex = mesh.vert[face.vert[j]];
      if (!vertex) continue;
      positions.push(vertex.x, vertex.y, vertex.z);
      var normalIndex = face.normalVertexIndex[j];
      if (normalIndex && mesh.normal[normalIndex]) {
        normals.push(mesh.normal[normalIndex].i, mesh.normal[normalIndex].j, mesh.normal[normalIndex].k);
      } else { normals.push(faceNormal.i, faceNormal.j, faceNormal.k); }

      if (face.textCoordsIndex[j] && mesh.textCoords[face.textCoordsIndex[j]]) {
        var uv = mesh.textCoords[face.textCoordsIndex[j]];
        texcoords.push(uv.u, uv.v);
      } else {
        texcoords.push(0, 0);
      }
      colors.push(faceColor[0], faceColor[1], faceColor[2], faceColor[3]);
      emissives.push(0, 0, 0, 0); 
    }
  }
  NavicellaBufferInfo = webglUtils.createBufferInfoFromArrays(gl, {
    position: { numComponents: 3, data: positions },
    normal: { numComponents: 3, data: normals },
    texcoord: { numComponents: 2, data: texcoords },
    color: { numComponents: 4, data: colors },
    emissive: { numComponents: 4, data: emissives },
  });

  var linePositions = [];
  var lineNormals = [];
  var lineTexcoords = [];
  var lineColors = [];
  var lineEmissives = [];

  for (var i = 1; i <= mesh.nface; i++) {
    var face = mesh.face[i];
    if (!face || !face.n_v_e) continue;
    for (var j = 0; j < face.n_v_e; j++) {
      var current = mesh.vert[face.vert[j]];
      var next = mesh.vert[face.vert[(j + 1) % face.n_v_e]];
      if (!current || !next) continue;
      linePositions.push(current.x, current.y, current.z, next.x, next.y, next.z);
      lineNormals.push(0, 0, 1, 0, 0, 1);
      lineTexcoords.push(0, 0, 0, 0);
      lineColors.push(0.8, 0.95, 1.0, 1.0, 0.8, 0.95, 1.0, 1.0);
      lineEmissives.push(0.8, 0.95, 1.0, 1.0, 0.8, 0.95, 1.0, 1.0);
    }
  }

  skeletonBufferInfo = webglUtils.createBufferInfoFromArrays(gl, {
    position: { numComponents: 3, data: linePositions },
    normal: { numComponents: 3, data: lineNormals },
    texcoord: { numComponents: 2, data: lineTexcoords },
    color: { numComponents: 4, data: lineColors },
    emissive: { numComponents: 4, data: lineEmissives },
  });
}

function createFlameBuffers(mesh) {
  var positions = [], normals = [], texcoords = [], colors = [], emissives = [];
  var defaultColor = [1.0, 0.5, 0.0, 0.4];
  for (var i = 1; i <= mesh.nface; i++) {
    var face = mesh.face[i];
    var faceNormal = mesh.facetnorms[i] || { i: 0, j: 0, k: 1 };
    for (var j = 0; j < face.n_v_e; j++) {
      var vertex = mesh.vert[face.vert[j]];
      if (!vertex) continue;
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(faceNormal.i, faceNormal.j, faceNormal.k);
      texcoords.push(0, 0);
      colors.push(defaultColor[0], defaultColor[1], defaultColor[2], defaultColor[3]);
      emissives.push(defaultColor[0], defaultColor[1], defaultColor[2], defaultColor[3]);
    }
  }
  flameBufferInfo = webglUtils.createBufferInfoFromArrays(gl, {
    position: { numComponents: 3, data: positions },
    normal: { numComponents: 3, data: normals },
    texcoord: { numComponents: 2, data: texcoords },
    color: { numComponents: 4, data: colors },
    emissive: { numComponents: 4, data: emissives },
  });
}

function loadMTLFile(url, mesh) {
  return fetch(url).then(res => res.text()).then(text => {
    glmReadMTL(text, mesh);
    return mesh;
  });
}

function loadModel() {
  loadOBJFile("navicella.obj")
    .then(function (text) {
      var mesh = new subd_mesh();
      var result = glmReadOBJ(text, mesh);
      Unitize(mesh);
      if (result.fileMtl) {
        return loadMTLFile(result.fileMtl, mesh).then(() => createBuffersFromMesh(mesh));
      }
      createBuffersFromMesh(mesh);
    }).catch(err => console.error(err));

  loadOBJFile("fiamma.obj")
    .then(function (text) {
      var mesh = new subd_mesh();
      glmReadOBJ(text, mesh);
      Unitize(mesh);
      createFlameBuffers(mesh);
    }).catch(err => console.error(err));
}

function updateMovement() {
  var speed = 0.05;

  if (moveState.left) spaceshipTranslation.x += speed;
  if (moveState.right) spaceshipTranslation.x -= speed;

  // Gestione dell'avvitamento della navicella
  if (isBarrelRolling) {
    barrelRollAngle += barrelRollSpeed;
    if (barrelRollAngle >= Math.PI * 2) {
      isBarrelRolling = false;
      barrelRollAngle = 0;
    }
  }

  // rotazione fluida calcolata solo in base agli input attivi delle frecce
  var targetRoll = 0;
  if (moveState.left) targetRoll = -0.3;
  if (moveState.right) targetRoll = 0.3;
  flightRotation += (targetRoll - flightRotation) * 0.15;

  // Quando la freccia viene tenuta premuta, la skybox ruota in base alla rotazione della navicella.
  // Quando si lascia la freccia, la skybox mantiene l'orientamento raggiunto.
  if (!isBarrelRolling) {
    if (moveState.left || moveState.right) {
      skyboxRotation += targetRoll * 0.04;
    }
  }
}

function updateThrust(now) {
  var thrustAcceleration = 0;
  if (thrustState.active) {
    thrustState.holdTime = (now - thrustState.startTime) / 1000;
    thrustAcceleration = thrustState.holdTime >= 2 ? 0.008 : 0.004;
    
    var baseScale = thrustState.holdTime < 2 
        ? 0.5 + thrustState.holdTime * 0.15 
        : 1.5 + (thrustState.holdTime - 2) * 0.2;

    var maxFlameScale = 0.9; 
    flameObjectScale = Math.min(baseScale, maxFlameScale);
  } else {
    thrustState.holdTime = 0;
    thrustAcceleration = -0.003;
    flameObjectScale *= 0.9;
    if (flameObjectScale < 0.05) flameObjectScale = 0;
  }

  velocityZ += thrustAcceleration;
  spaceshipTranslation.z += velocityZ;

  if (spaceshipTranslation.z <= floorZ) {
    spaceshipTranslation.z = floorZ;
    velocityZ = 0;
  }
  spaceshipTranslation.y += velocityZ;

  if (spaceshipTranslation.z > maxZReached) maxZReached = spaceshipTranslation.z;
  if (spaceshipTranslation.z < minZReached) minZReached = spaceshipTranslation.z;
  updateStatus();
}

function updateStatus() {
  if (!startPointElement) return;
  startPointElement.textContent = startZ.toFixed(2);
  finishPointElement.textContent = spaceshipTranslation.z.toFixed(2);
  highestPointElement.textContent = maxZReached.toFixed(2);
  lowestPointElement.textContent = minZReached.toFixed(2);
}

function animate(now) {
  if (!animationStarted) return;
  requestAnimationFrame(animate);
  updateMovement();
  updateThrust(now || performance.now());
  drawScene();
}

function play() {
  if (!animationStarted) {
    animationStarted = true;
    spaceshipTranslation = { x: 0, y: 0, z: 0.1 }; 
    velocityZ = 0; 
    startZ = spaceshipTranslation.z;
    maxZReached = startZ;
    minZReached = startZ;
    updateStatus();
    animate(performance.now());
  }
}

function startBarrelRoll() {
  if (!isBarrelRolling) {
    isBarrelRolling = true;
    barrelRollAngle = 0;
  }
}

function avviaAvvitamento() {
  startBarrelRoll();
}

function toggleSkeleton() {
  showSkeleton = !showSkeleton;
  updateToggleButtons();
}

function toggleSkybox() {
  showSkybox = !showSkybox;
  updateToggleButtons();
}

function setControlsPanelOpen(open) {
  controlsPanelOpen = open;
  var panel = document.querySelector('.controls-panel');
  var openButton = document.getElementById('btn-open-panel');
  if (panel) panel.classList.toggle('hidden', !open);
  if (openButton) openButton.style.display = open ? 'none' : 'block';
}

function toggleControlsPanel() {
  setControlsPanelOpen(!controlsPanelOpen);
}

function switchSkybox(setName) {
  if (!skyboxSets[setName]) return;
  currentSkyboxSet = setName;
  loadCubemap(skyboxSets[setName]);
  var selectedButtonId = 'btn-skybox-default';
  if (setName === 'second') selectedButtonId = 'btn-skybox-second';
  else if (setName === 'third') selectedButtonId = 'btn-skybox-third';
  else if (setName === 'fourth') selectedButtonId = 'btn-skybox-fourth';
  setSkyboxButtonState(selectedButtonId);
  showSkybox = true;
  updateToggleButtons();
}

function makeButtonHold(button, startFn, endFn) {
  if (!button) return;
  button.addEventListener('mousedown', function (e) {
    e.preventDefault();
    startFn();
  });
  button.addEventListener('mouseup', endFn);
  button.addEventListener('mouseleave', endFn);
  button.addEventListener('touchstart', function (e) {
    e.preventDefault();
    startFn();
  });
  button.addEventListener('touchend', endFn);
}

function setSkyboxButtonState(selectedButtonId) {
  var skyboxDefault = document.getElementById('btn-skybox-default');
  var skyboxSecond = document.getElementById('btn-skybox-second');
  var skyboxThird = document.getElementById('btn-skybox-third');
  var skyboxFourth = document.getElementById('btn-skybox-fourth');
  if (skyboxDefault) skyboxDefault.classList.toggle('active', selectedButtonId === 'btn-skybox-default');
  if (skyboxSecond) skyboxSecond.classList.toggle('active', selectedButtonId === 'btn-skybox-second');
  if (skyboxThird) skyboxThird.classList.toggle('active', selectedButtonId === 'btn-skybox-third');
  if (skyboxFourth) skyboxFourth.classList.toggle('active', selectedButtonId === 'btn-skybox-fourth');
}

function updateToggleButtons() {
  var skeletonButton = document.getElementById('btn-toggle-skeleton');
  var skyboxButton = document.getElementById('btn-toggle-skybox');
  var lightButton = document.getElementById('btn-toggle-light');
  if (skeletonButton) skeletonButton.textContent = showSkeleton ? 'Nascondi scheletro' : 'Mostra scheletro';
  if (skyboxButton) skyboxButton.textContent = showSkybox ? 'Nascondi skybox' : 'Mostra skybox';
  if (lightButton) lightButton.textContent = lightEnabled ? 'Spegni luce' : 'Accendi luce';
}

function toggleLight() {
  lightEnabled = !lightEnabled;
  updateToggleButtons();
}

function triggerFlame() {
  if (!animationStarted) play();
  if (!thrustState.active) {
    thrustState.active = true;
    thrustState.startTime = performance.now();
  }
  if (thrustState.clickTimeout) clearTimeout(thrustState.clickTimeout);
  thrustState.clickTimeout = setTimeout(function() {
    thrustState.active = false;
  }, 250);
}

function initInterface() {
  flameElement = document.getElementById("flame");
  startPointElement = document.getElementById("startPoint");
  finishPointElement = document.getElementById("finishPoint");
  highestPointElement = document.getElementById("highestPoint");
  lowestPointElement = document.getElementById("lowestPoint");

  canvas.addEventListener("click", triggerFlame);
  canvas.addEventListener("mousemove", onCanvasMouseMove);
  canvas.addEventListener("mouseleave", () => (mouseControlEnabled = false));

  var btnLeft = document.getElementById("btn-left");
  var btnRight = document.getElementById("btn-right");
  var btnThrust = document.getElementById("btn-thrust");
  var btnRoll = document.getElementById("btn-roll");
  var btnSkeleton = document.getElementById("btn-toggle-skeleton");
  var btnSkyboxToggle = document.getElementById("btn-toggle-skybox");
  var btnSkyboxDefault = document.getElementById("btn-skybox-default");
  var btnSkyboxSecond = document.getElementById("btn-skybox-second");
  var btnSkyboxThird = document.getElementById("btn-skybox-third");
  var btnSkyboxFourth = document.getElementById("btn-skybox-fourth");
  var btnLight = document.getElementById("btn-toggle-light");

  makeButtonHold(btnLeft, function() { if (!animationStarted) play(); moveState.left = true; }, function() { moveState.left = false; });
  makeButtonHold(btnRight, function() { if (!animationStarted) play(); moveState.right = true; }, function() { moveState.right = false; });
  makeButtonHold(btnThrust, function() { if (!animationStarted) play(); if (!thrustState.active) { thrustState.active = true; thrustState.startTime = performance.now(); } }, function() { thrustState.active = false; });

  if (btnRoll) btnRoll.addEventListener("click", function() { if (!animationStarted) play(); startBarrelRoll(); });
  if (btnSkeleton) btnSkeleton.addEventListener("click", toggleSkeleton);
  
  // Listener per lo slider di velocità avvitamento
  var rollSpeedSlider = document.getElementById('roll-speed-slider');
  var rollSpeedValue = document.getElementById('roll-speed-value');
  if (rollSpeedSlider) {
    rollSpeedSlider.addEventListener('input', function() {
      barrelRollSpeed = parseFloat(this.value);
      if (rollSpeedValue) {
        rollSpeedValue.textContent = barrelRollSpeed.toFixed(2);
      }
    });
  }
  
  if (btnSkyboxToggle) btnSkyboxToggle.addEventListener("click", toggleSkybox);
  if (btnSkyboxDefault) btnSkyboxDefault.addEventListener("click", function() { switchSkybox('default'); });
  if (btnSkyboxSecond) btnSkyboxSecond.addEventListener("click", function() { switchSkybox('second'); });
  if (btnSkyboxThird) btnSkyboxThird.addEventListener("click", function() { switchSkybox('third'); });
  if (btnSkyboxFourth) btnSkyboxFourth.addEventListener("click", function() { switchSkybox('fourth'); });
  if (btnLight) btnLight.addEventListener('click', toggleLight);

  var btnClosePanel = document.getElementById("btn-close-panel");
  var btnOpenPanel = document.getElementById("btn-open-panel");
  if (btnClosePanel) btnClosePanel.addEventListener("click", toggleControlsPanel);
  if (btnOpenPanel) btnOpenPanel.addEventListener("click", toggleControlsPanel);

  setSkyboxButtonState('btn-skybox-default');
  updateToggleButtons();
  updateStatus();
  setControlsPanelOpen(true);
}

/*=================== INPUT INTERACTION =================== */
canvas.addEventListener("mousedown", function(e) {
  if (e.button === 0) { // Click sinistro trascina la visuale
    drag = true;
    old_x = e.pageX;
    old_y = e.pageY;
    e.preventDefault();
  }
  if (e.button === 2) { // Click destro avvia l'avvitamento
    startBarrelRoll();
    e.preventDefault();
  }
});

canvas.addEventListener("mouseup", function() { drag = false; });
canvas.addEventListener("mouseleave", function() { drag = false; });

canvas.addEventListener("mousemove", function(e) {
  if (!drag) return;
  
  // Calcolo lo spostamento del mouse per ruotare la testa
  var dX = (e.pageX - old_x) * 1.5 * Math.PI / canvas.width;
  var dY = (e.pageY - old_y) * 1.5 * Math.PI / canvas.height;
  
  teta -= dX; // Invertito il segno per rendere il drag naturale (trascini lo sfondo)
  fi += dY;
  
  // Evitiamo che la telecamera si ribalti sopra il polo Nord o sotto il polo Sud
  if (fi < 0.05) fi = 0.05;
  if (fi > Math.PI - 0.05) fi = Math.PI - 0.05;
  
  old_x = e.pageX;
  old_y = e.pageY;
  e.preventDefault();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// --- GESTIONE DRAG A DUE DITA (TOUCH MOBILE) ---
var touch_old_x = 0, touch_old_y = 0;
var touches_count = 0;

canvas.addEventListener("touchstart", function(e) {
  touches_count = e.touches.length;
  if (touches_count >= 2) {
    // Due o più dita: inizia drag camera
    drag = true;
    touch_old_x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
    touch_old_y = (e.touches[0].pageY + e.touches[1].pageY) / 2;
    e.preventDefault();
  }
});

canvas.addEventListener("touchmove", function(e) {
  if (e.touches.length >= 2 && drag) {
    var touch_x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
    var touch_y = (e.touches[0].pageY + e.touches[1].pageY) / 2;
    
    var dX = (touch_x - touch_old_x) * 1.5 * Math.PI / canvas.width;
    var dY = (touch_y - touch_old_y) * 1.5 * Math.PI / canvas.height;
    
    teta -= dX;
    fi += dY;
    
    if (fi < 0.05) fi = 0.05;
    if (fi > Math.PI - 0.05) fi = Math.PI - 0.05;
    
    touch_old_x = touch_x;
    touch_old_y = touch_y;
    e.preventDefault();
  }
});

canvas.addEventListener("touchend", function(e) {
  if (e.touches.length < 2) {
    drag = false;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!animationStarted) play();
  }
  // Barrel roll: tasto A o B
  if (e.key === "B" || e.key === "b" || e.key === "A" || e.key === "a") {
    e.preventDefault();
    startBarrelRoll();
  }
  // Propulsore: ArrowUp, Spacebar, frequentemente usato
  if (e.key === "ArrowUp" || e.key === " ") {
    e.preventDefault();
    if (!thrustState.active) {
      thrustState.active = true;
      thrustState.startTime = performance.now();
    }
  }
  // Movimento laterale
  if (e.key === "ArrowLeft") moveState.left = true;
  if (e.key === "ArrowRight") moveState.right = true;
});

document.addEventListener("keyup", (e) => {
  // Stop propulsore
  if (e.key === "ArrowUp" || e.key === " ") thrustState.active = false;
  // Stop movimento laterale
  if (e.key === "ArrowLeft") moveState.left = false;
  if (e.key === "ArrowRight") moveState.right = false;
});

// --- EXECUTION BOOT ---
createPrograms();
initInterface();
initSkyboxGeometry();
  // Carichiamo lo skybox di default all'avvio
  try {
    loadCubemap(skyboxSets[currentSkyboxSet]);
    showSkybox = true;
  } catch (e) {
    // il caricamento fallito dello skybox viene gestito dal debugger del browser se necessario
  }
loadModel();
play();