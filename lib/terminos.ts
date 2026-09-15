/**
 * Version del documento de terminos que el comercio acepta al inscribirse.
 *
 * Se guarda junto al consentimiento en `comercios.version_terminos`. Cada vez
 * que cambie el texto de /terminos hay que subir esta version: sin eso no se
 * puede probar que version acepto cada comercio, que es justamente lo que pide
 * la Ley 21.719.
 */
export const VERSION_TERMINOS = "2026-09-15-borrador-1";

export const TERMINOS_EN_BORRADOR = true;
