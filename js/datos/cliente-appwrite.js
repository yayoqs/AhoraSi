/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/cliente-appwrite.js
   Versión: 2.0.0
   Propósito: instancia única del cliente Appwrite. Expone Client,
              Account y TablesDB. También reexporta los helpers del
              SDK (Query, Permission, Role, ID, Realtime, Channel,
              Operator) para que ningún otro módulo dependa del
              global window.Appwrite.
              v2.0.0: se cambia el origen del SDK. Ya no se importa
                      desde esm.sh. Se toma de window.Appwrite, que
                      es poblado por js/appwrite.min.js (bundle UMD
                      v25, cargado como <script> clásico). Se
                      reexportan helpers. Se agrega verificación de
                      disponibilidad con mensaje claro.
              v1.0.1: SDK desde esm.sh@21.
              v1.0.0: versión inicial.
   ================================================================ */

import { CONFIG } from '../config/config.js';
import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('cliente-appwrite');

function obtenerSdk() {
  const sdk = globalThis.Appwrite;
  if (!sdk) {
    throw new Error(
      'SDK de Appwrite no disponible. Verifica que js/appwrite.min.js ' +
      'esté cargado antes que este módulo.'
    );
  }
  if (typeof sdk.Client !== 'function') {
    throw new Error('El bundle cargado no expone Client.');
  }
  if (typeof sdk.TablesDB !== 'function') {
    throw new Error('El bundle cargado no expone TablesDB.');
  }
  return sdk;
}

const sdk = obtenerSdk();

export const ID = sdk.ID;
export const Query = sdk.Query;
export const Permission = sdk.Permission;
export const Role = sdk.Role;
export const Realtime = sdk.Realtime;
export const Channel = sdk.Channel;
export const Operator = sdk.Operator;

let cliente = null;
let account = null;
let tablesDB = null;

export function obtenerCliente() {
  if (!cliente) {
    cliente = new sdk.Client()
      .setEndpoint(CONFIG.appwrite.endpoint)
      .setProject(CONFIG.appwrite.projectId);
    log.info('Cliente Appwrite inicializado contra', CONFIG.appwrite.endpoint);
  }
  return cliente;
}

export function obtenerAccount() {
  if (!account) account = new sdk.Account(obtenerCliente());
  return account;
}

export function obtenerTablesDB() {
  if (!tablesDB) tablesDB = new sdk.TablesDB(obtenerCliente());
  return tablesDB;
}

export function obtenerDatabaseId() {
  return CONFIG.appwrite.databaseId;
}

export function reiniciar() {
  cliente = null;
  account = null;
  tablesDB = null;
  log.info('Cliente Appwrite reiniciado');
}