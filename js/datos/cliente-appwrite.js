/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/cliente-appwrite.js
   Versión: 2.1.0
   Propósito: instancia única del cliente Appwrite. Expone Client,
              Account, TablesDB y Storage. Reexporta los helpers
              del SDK para que ningún otro módulo dependa del
              global window.Appwrite.
              v2.1.0: se agrega Storage. Verifica que el bundle
                      lo exponga.
              v2.0.0: SDK desde window.Appwrite (UMD local v25).
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
  if (typeof sdk.Storage !== 'function') {
    throw new Error('El bundle cargado no expone Storage.');
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
let storage = null;

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

export function obtenerStorage() {
  if (!storage) storage = new sdk.Storage(obtenerCliente());
  return storage;
}

export function obtenerDatabaseId() {
  return CONFIG.appwrite.databaseId;
}

export function reiniciar() {
  cliente = null;
  account = null;
  tablesDB = null;
  storage = null;
  log.info('Cliente Appwrite reiniciado');
}