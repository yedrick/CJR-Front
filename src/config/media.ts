// Imágenes de la interfaz (no son datos del sistema).
// =========================================================
// FOTOS DE JÓVENES (fondos de portada y campamentos)
// =========================================================
const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

export const YOUTH_PHOTOS = {
  friendsArms: img('photo-1529156069898-49953e39b3ac'),
  sunsetHug: img('photo-1511632765486-a01980e01a18'),
  handsUpSunset: img('photo-1506869640319-fe1a24fd76dc'),
  groupSitting: img('photo-1517486808906-6ca8b3f04846'),
  worshipConcert: img('photo-1501281668745-f7f57925c3b4'),
  colorFestival: img('photo-1496024840928-4c417adf211d'),
  hillSunset: img('photo-1464207687429-7505649dae38'),
  campNight: img('photo-1504851149312-7a075b496cc7'),
  unityHands: img('photo-1527525443983-6e60c75fff46'),
  crowdParty: img('photo-1517457373958-b7bdd4587205'),
  conference: img('photo-1523580494863-6f3031224c94'),
  studyGroup: img('photo-1522202176988-66273c2fd55f'),
  girlsSmile: img('photo-1491438590914-bc09fcaaf77a'),
  guysStreet: img('photo-1543807535-eceef0bc6599'),
  campfire: img('photo-1517824806704-9040b037703b'),
  mountains: img('photo-1464822759023-fed622ff2c3b'),
  campBase: img('photo-1504280390367-361c6d9f38f4'),
};

/** Fotos que rotan de fondo en la portada. */
export const HERO_BACKGROUNDS = [
  YOUTH_PHOTOS.friendsArms,
  YOUTH_PHOTOS.handsUpSunset,
  YOUTH_PHOTOS.sunsetHug,
  YOUTH_PHOTOS.worshipConcert,
];

