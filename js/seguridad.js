/* =========================================================
   ASADA OROSI
   SEGURIDAD, ROLES, AUDITORÍA Y BORRADORES

   Este archivo se agrega como un archivo independiente del
   proyecto de Apps Script. No duplique sus constantes ni sus
   funciones dentro de Code.gs.
   ========================================================= */

const ASADA_USERS_SHEET_NAME =
  "Usuarios";

const ASADA_AUDIT_SHEET_NAME =
  "Auditoria";

const ASADA_DRAFTS_SHEET_NAME =
  "Borradores";

const ASADA_DRAFTS_FOLDER_NAME =
  "Borradores ASADA";

const ASADA_WORKSPACE_DOMAIN =
  "asadaorosi.com";

const ASADA_LOGIN_CODE_TTL_SECONDS =
  10 * 60;

const ASADA_LOGIN_RATE_SECONDS =
  60;

const ASADA_SESSION_TTL_SECONDS =
  24 * 60 * 60;

/*
    CacheService puede conservar datos por menos tiempo que la sesión
    solicitada. La sesión completa se guarda también en propiedades del
    proyecto y la caché se utiliza únicamente como acelerador.
*/
const ASADA_SESSION_CACHE_TTL_SECONDS =
  6 * 60 * 60;

const ASADA_SESSION_PROPERTY_PREFIX =
  "ASADA_SESSION_";

const ASADA_LOGIN_SENDER_EMAIL =
  "iniciosesionasada@gmail.com";

const ASADA_OPERATOR_PROFILES = {
  fontanero_1: "Rodolfo",
  fontanero_2: "Guillermo",
  fontanero_3: "Paul",
  fontanero_4: "Roberto"
};

/*
    Los administradores iniciales proporcionados para el sistema.
    Los trabajadores se registran explícitamente en la hoja Usuarios.
    No se acepta automáticamente cualquier cuenta del dominio.
*/
const ASADA_ADMIN_EMAILS = {
  "ronald.rojas@asadaorosi.com": "Ronald Rojas",
  "maria.barrantes@asadaorosi.com": "María Barrantes",
  "chinchillap086@gmail.com": "Paola Chinchilla"
};

const ASADA_ADMIN_EMAIL_MIGRATIONS = {
  "ronal.rojas@asadaorosi.com": "ronald.rojas@asadaorosi.com"
};

const ASADA_WORKER_EMAILS = {
  "asadaorosi4@gmail.com": "Departamento de Campo"
};

/*
    Cuentas que pudieron haber sido agregadas por una versión anterior.
    Se conservan en la hoja, pero quedan inactivas y no pueden iniciar sesión.
*/
const ASADA_DISABLED_EMAILS = [
  "depcampo1@gmail.com",
  "depcampo2@gmail.com"
];

const ASADA_ALLOW_DOMAIN_WORKERS =
  false;

const ASADA_USER_HEADERS = [
  "Correo",
  "Nombre",
  "Rol",
  "Activo"
];

const ASADA_AUDIT_HEADERS = [
  "FechaHora",
  "Correo",
  "Rol",
  "Accion",
  "RegistroID",
  "Detalle"
];

const ASADA_DRAFT_HEADERS = [
  "Clave",
  "Correo",
  "Perfil",
  "Tipo",
  "ClienteID",
  "DatosJSON",
  "ArchivosJSON",
  "FechaCreacion",
  "FechaActualizacion"
];

const ASADA_DRAFT_TYPES = [
  "mantenimiento",
  "accidente",
  "factibilidad"
];

const ASADA_DRAFT_MAX_FILE_BYTES =
  6 * 1024 * 1024;

const ASADA_DRAFT_MAX_TOTAL_BYTES =
  18 * 1024 * 1024;

/* =========================================================
   IDENTIDAD Y ROLES
   ========================================================= */

function asadaNormalizeEmail_(value) {

  return String(value || "")
    .trim()
    .toLowerCase();
}

function asadaIsValidEmail_(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function asadaGetLoginCache_() {

  return CacheService.getScriptCache();
}

function asadaGetActiveEmail_(sessionToken) {

  const token = String(sessionToken || "").trim();

  if (!token) {
    throw new Error(
      "Debe iniciar sesión con su correo electrónico."
    );
  }

  const cacheKey = "asada-session-" + token;
  const propertiesKey = ASADA_SESSION_PROPERTY_PREFIX + token;
  const cache = asadaGetLoginCache_();
  let session = asadaParseJson_(cache.get(cacheKey), null);

  if (!session) {
    session = asadaParseJson_(
      PropertiesService
        .getScriptProperties()
        .getProperty(propertiesKey),
      null
    );
  }

  if (
    session &&
    Number(session.expiresAt || 0) <= Date.now()
  ) {
    cache.remove(cacheKey);
    PropertiesService
      .getScriptProperties()
      .deleteProperty(propertiesKey);
    session = null;
  }

  const email = asadaNormalizeEmail_(session && session.email);

  if (!session || !asadaIsValidEmail_(email)) {
    throw new Error(
      "La sesión venció. Inicie sesión nuevamente."
    );
  }

  return email;
}

function asadaFindUserByEmail_(email) {

  email = asadaNormalizeEmail_(email);

  if (ASADA_DISABLED_EMAILS.includes(email)) {
    return null;
  }

  const sheet = asadaEnsureUsersSheet_();

  /*
      Estos tres correos son administradores del sistema. La autorización
      no debe depender de que una fila antigua de la hoja Usuarios tenga
      el rol escrito correctamente; así se evita bloquear a un admin por
      una corrección manual o por datos de una versión anterior.
  */
  if (Object.prototype.hasOwnProperty.call(ASADA_ADMIN_EMAILS, email)) {
    return {
      email,
      name: ASADA_ADMIN_EMAILS[email],
      role: "admin",
      isAdmin: true
    };
  }

  const headerMap = asadaHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getDisplayValues();

  for (let index = 0; index < rows.length; index++) {
    const candidate = rows[index];
    const candidateEmail = asadaNormalizeEmail_(
      candidate[headerMap.Correo]
    );

    if (candidateEmail !== email) {
      continue;
    }

    if (!asadaValueIsActive_(candidate[headerMap.Activo])) {
      throw new Error(
        "La cuenta no está activa para utilizar el sistema."
      );
    }

    const role = String(candidate[headerMap.Rol] || "worker")
      .trim()
      .toLowerCase();

    return {
      email,
      name: String(candidate[headerMap.Nombre] || email).trim(),
      role: role === "admin" || role === "administrador"
        ? "admin"
        : "worker",
      isAdmin: role === "admin" || role === "administrador"
    };
  }

  if (
    ASADA_ALLOW_DOMAIN_WORKERS &&
    email.endsWith("@" + ASADA_WORKSPACE_DOMAIN)
  ) {
    return {
      email,
      name: email,
      role: "worker",
      isAdmin: false
    };
  }

  return null;
}

function asadaNormalizeLoginRequestId_(value) {

  const requestId = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  return requestId || "principal";
}

function asadaLoginGreetingName_(user, perfil) {

  const selectedProfile = String(perfil || "").trim();
  const operatorNames = Object.keys(ASADA_OPERATOR_PROFILES)
    .map(key => ASADA_OPERATOR_PROFILES[key]);

  if (operatorNames.includes(selectedProfile)) {
    return selectedProfile;
  }

  const namesByEmail = {
    "ronald.rojas@asadaorosi.com": "Ronald Rojas",
    "maria.barrantes@asadaorosi.com": "María Barrantes",
    "chinchillap086@gmail.com": "Paola Chinchilla"
  };

  return namesByEmail[user.email] ||
    String(user.name || "usuario").trim() ||
    "usuario";
}

function asadaEscapeHtml_(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asadaSendLoginCodeEmail_(email, user, code, loginRequestId, perfil) {

  const greetingName = asadaLoginGreetingName_(user, perfil);
  const subject = "Código de verificación de Asada Orosi";
  const body =
    "Hola, " + greetingName + "\n\n" +
    "Tu código de verificación para iniciar sesión en el sistema de ASADA Orosi es:\n\n" +
    code + "\n\n" +
    "Este código es válido durante los próximos 10 minutos. Por motivos de seguridad no compartas este código con nadie.\n\n" +
    "Si no solicitaste este código, puedes ignorar este mensaje de manera segura.\n\n" +
    "Este es un correo automático, por favor no respondas a este mensaje.\n\n" +
    "Atentamente,\n" +
    "ASADA Orosi.";

  const safeName = asadaEscapeHtml_(greetingName);
  const safeCode = asadaEscapeHtml_(code);
  const htmlBody =
    "<p>Hola, " + safeName + "</p>" +
    "<p>Tu código de verificación para iniciar sesión en el sistema de ASADA Orosi es:</p>" +
    "<p style=\"font-size:24px;font-weight:700;letter-spacing:4px;\">" +
      safeCode +
    "</p>" +
    "<p>Este código es válido durante los próximos 10 minutos. Por motivos de seguridad no compartas este código con nadie.</p>" +
    "<p>Si no solicitaste este código, puedes ignorar este mensaje de manera segura.</p>" +
    "<p>Este es un correo automático, por favor no respondas a este mensaje.</p>" +
    "<p>Atentamente,<br>ASADA Orosi.</p>";

  const options = {
    htmlBody,
    name: "ASADA Orosi",
    replyTo: ASADA_LOGIN_SENDER_EMAIL
  };

  try {
    const aliases = typeof GmailApp !== "undefined"
      ? GmailApp.getAliases().map(value => String(value).toLowerCase())
      : [];

    if (aliases.includes(ASADA_LOGIN_SENDER_EMAIL)) {
      options.from = ASADA_LOGIN_SENDER_EMAIL;
    }

    if (typeof GmailApp !== "undefined") {
      GmailApp.sendEmail(email, subject, body, options);
      return;
    }
  } catch (error) {
    console.error("No fue posible enviar con GmailApp; se intentará MailApp.", error);
  }

  MailApp.sendEmail({
    to: email,
    subject,
    body,
    htmlBody,
    name: "ASADA Orosi",
    replyTo: ASADA_LOGIN_SENDER_EMAIL
  });
}

function requestAsadaLoginCode(email, loginRequestId, perfil) {

  email = asadaNormalizeEmail_(email);
  loginRequestId = asadaNormalizeLoginRequestId_(loginRequestId);

  if (!asadaIsValidEmail_(email)) {
    throw new Error("Escriba un correo electrónico válido.");
  }

  const user = asadaFindUserByEmail_(email);

  if (!user) {
    throw new Error(
      "Ese correo no está registrado en la hoja Usuarios."
    );
  }

  const cache = asadaGetLoginCache_();
  const suffix = "-" + loginRequestId;
  const rateKey = "asada-login-rate-" + email + suffix;

  if (cache.get(rateKey)) {
    throw new Error(
      "Espere un minuto antes de solicitar otro código."
    );
  }

  const code = String(
    parseInt(
      Utilities.getUuid().replace(/-/g, "").slice(0, 8),
      16
    ) % 1000000
  ).padStart(6, "0");

  cache.put(
    "asada-login-code-" + email + suffix,
    JSON.stringify({ email, code, loginRequestId, perfil }),
    ASADA_LOGIN_CODE_TTL_SECONDS
  );

  cache.put(
    "asada-login-attempts-" + email + suffix,
    "0",
    ASADA_LOGIN_CODE_TTL_SECONDS
  );

  cache.put(
    rateKey,
    "1",
    ASADA_LOGIN_RATE_SECONDS
  );

  asadaSendLoginCodeEmail_(
    email,
    user,
    code,
    loginRequestId,
    perfil
  );

  return {
    sent: true,
    expiresInSeconds: ASADA_LOGIN_CODE_TTL_SECONDS
  };
}

function verifyAsadaLoginCode(email, code, loginRequestId) {

  email = asadaNormalizeEmail_(email);
  code = String(code || "").trim();
  loginRequestId = asadaNormalizeLoginRequestId_(loginRequestId);

  const user = asadaFindUserByEmail_(email);
  const cache = asadaGetLoginCache_();
  const suffix = "-" + loginRequestId;
  const key = "asada-login-code-" + email + suffix;
  const attemptsKey = "asada-login-attempts-" + email + suffix;
  const stored = asadaParseJson_(cache.get(key), null);
  const attempts = Number(cache.get(attemptsKey) || 0);

  if (attempts >= 5) {
    cache.remove(key);
    cache.remove(attemptsKey);
    throw new Error(
      "Se superó el número de intentos. Solicite un nuevo código."
    );
  }

  if (
    !user ||
    !stored ||
    stored.email !== email ||
    stored.loginRequestId !== loginRequestId ||
    stored.code !== code
  ) {
    cache.put(
      attemptsKey,
      String(attempts + 1),
      ASADA_LOGIN_CODE_TTL_SECONDS
    );
    throw new Error("El código no es válido o ya venció.");
  }

  cache.remove(key);
  cache.remove(attemptsKey);

  const sessionToken = Utilities.getUuid();

  const sessionData = {
    email,
    createdAt: new Date().toISOString(),
    expiresAt:
      Date.now() + ASADA_SESSION_TTL_SECONDS * 1000
  };
  const sessionJson = JSON.stringify(sessionData);
  const sessionCacheKey = "asada-session-" + sessionToken;
  const sessionPropertiesKey =
    ASADA_SESSION_PROPERTY_PREFIX + sessionToken;

  cache.put(
    sessionCacheKey,
    sessionJson,
    ASADA_SESSION_CACHE_TTL_SECONDS
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      sessionPropertiesKey,
      sessionJson
    );

  return {
    sessionToken,
    user
  };
}

function asadaGetOrCreateSheet_(name, headers) {

  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  let currentHeaders = sheet.getLastColumn() > 0
    ? sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(value => String(value || "").trim())
    : [];

  if (!currentHeaders.some(Boolean)) {
    currentHeaders = headers.slice();
    sheet
      .getRange(1, 1, 1, currentHeaders.length)
      .setValues([currentHeaders]);
  } else {
    headers.forEach(header => {
      if (!currentHeaders.includes(header)) {
        currentHeaders.push(header);
        sheet
          .getRange(1, currentHeaders.length)
          .setValue(header);
      }
    });
  }

  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, currentHeaders.length)
    .setFontWeight("bold")
    .setBackground("#1f4d46")
    .setFontColor("#ffffff");

  return sheet;
}

function asadaEnsureUsersSheet_() {

  const sheet = asadaGetOrCreateSheet_(
    ASADA_USERS_SHEET_NAME,
    ASADA_USER_HEADERS
  );

  asadaApplyUserCorrections_(sheet);

  const headerMap = asadaHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2
    ? sheet
      .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
      .getDisplayValues()
    : [];

  Object.keys(ASADA_ADMIN_EMAILS).forEach(email => {

    const found = rows.some(row =>
      String(row[headerMap.Correo] || "")
        .trim()
        .toLowerCase() === email
    );

    if (!found) {
      const values = [];
      for (let index = 0; index < sheet.getLastColumn(); index++) {
        values.push("");
      }

      values[headerMap.Correo] = email;
      values[headerMap.Nombre] = ASADA_ADMIN_EMAILS[email];
      values[headerMap.Rol] = "admin";
      values[headerMap.Activo] = "Sí";
      sheet.appendRow(values);
    }
  });

  Object.keys(ASADA_WORKER_EMAILS).forEach(email => {

    const found = rows.some(row =>
      String(row[headerMap.Correo] || "")
        .trim()
        .toLowerCase() === email
    );

    if (!found) {
      const values = [];
      for (let index = 0; index < sheet.getLastColumn(); index++) {
        values.push("");
      }

      values[headerMap.Correo] = email;
      values[headerMap.Nombre] = ASADA_WORKER_EMAILS[email];
      values[headerMap.Rol] = "worker";
      values[headerMap.Activo] = "Sí";
      sheet.appendRow(values);
    }
  });

  return sheet;
}

function asadaDraftFirstName_(value) {

  const name = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return name.split(" ")[0] || "Usuario";
}

function asadaDraftProfile_(email, clientId, profile) {

  const explicit = String(profile || "")
    .replace(/\s+/g, " ")
    .trim();

  if (explicit) {
    return explicit;
  }

  const normalizedEmail = asadaNormalizeEmail_(email);
  if (Object.prototype.hasOwnProperty.call(ASADA_ADMIN_EMAILS, normalizedEmail)) {
    return asadaDraftFirstName_(ASADA_ADMIN_EMAILS[normalizedEmail]);
  }

  const normalizedClientId = String(clientId || "").toLowerCase();
  const operatorKey = Object.keys(ASADA_OPERATOR_PROFILES).find(key =>
    normalizedClientId.endsWith("_" + key.toLowerCase()) ||
    normalizedClientId.includes("_" + key.toLowerCase() + "_")
  );

  if (operatorKey) {
    return ASADA_OPERATOR_PROFILES[operatorKey];
  }

  return "Usuario";
}

function asadaDraftIsJsonObject_(value) {

  const parsed = asadaParseJson_(value, null);
  return Boolean(
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
  );
}

function asadaDraftIsJsonArray_(value) {

  return Array.isArray(asadaParseJson_(value, null));
}

function asadaNormalizeDraftSheet_(sheet) {

  const expectedHeaders = ASADA_DRAFT_HEADERS.slice();
  const currentColumnCount = sheet.getLastColumn();
  const currentHeaders = currentColumnCount > 0
    ? sheet
      .getRange(1, 1, 1, currentColumnCount)
      .getDisplayValues()[0]
      .map(value => String(value || "").trim())
    : [];

  const alreadyNormalized =
    currentHeaders.length === expectedHeaders.length &&
    expectedHeaders.every((header, index) => currentHeaders[index] === header);

  if (alreadyNormalized) {
    return sheet;
  }

  const headerMap = {};
  currentHeaders.forEach((header, index) => {
    if (header) {
      headerMap[header] = index;
    }
  });

  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2 && currentColumnCount > 0
    ? sheet
      .getRange(2, 1, lastRow - 1, currentColumnCount)
      .getValues()
    : [];

  const legacyHeaderOrder =
    currentHeaders[3] === "DatosJSON" &&
    currentHeaders[4] === "ArchivosJSON" &&
    currentHeaders[5] === "FechaCreacion" &&
    currentHeaders[6] === "FechaActualizacion" &&
    currentHeaders[7] === "ClienteID";

  const normalizedRows = rows.map(row => {
    /*
        Algunas filas fueron escritas con el orden nuevo mientras la hoja
        todavía conservaba los encabezados antiguos. En esas filas D es el
        ClienteID y E/F son los dos JSON. Se detectan antes de remapear por
        encabezado para no perder los borradores existentes.
    */
    const rowWasWrittenWithNewOrder =
      legacyHeaderOrder &&
      !asadaDraftIsJsonObject_(row[3]) &&
      asadaDraftIsJsonObject_(row[4]) &&
      asadaDraftIsJsonArray_(row[5]);

    const source = rowWasWrittenWithNewOrder
      ? {
          Clave: row[0],
          Correo: row[1],
          Tipo: row[2],
          ClienteID: row[3],
          DatosJSON: row[4],
          ArchivosJSON: row[5],
          FechaCreacion: row[6],
          FechaActualizacion: row[7],
          Perfil: ""
        }
      : expectedHeaders.reduce((result, header) => {
          const index = headerMap[header];
          result[header] = index === undefined ? "" : row[index];
          return result;
        }, {});

    const email = asadaNormalizeEmail_(source.Correo);
    const type = String(source.Tipo || "").trim().toLowerCase();
    const clientId = asadaNormalizeClientId_(source.ClienteID);
    const profile = asadaDraftProfile_(email, clientId, source.Perfil);

    return [
      [email, profile, clientId, type].join("|"),
      email,
      profile,
      type,
      clientId,
      source.DatosJSON || "{}",
      source.ArchivosJSON || "[]",
      source.FechaCreacion || "",
      source.FechaActualizacion || ""
    ];
  });

  sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders]);

  if (normalizedRows.length) {
    sheet
      .getRange(2, 1, normalizedRows.length, expectedHeaders.length)
      .setValues(normalizedRows);

    sheet
      .getRange(2, 8, normalizedRows.length, 2)
      .setNumberFormat("yyyy-mm-dd hh:mm:ss");
  }

  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .setFontWeight("bold")
    .setBackground("#1f4d46")
    .setFontColor("#ffffff");

  return sheet;
}

function asadaApplyUserCorrections_(sheet) {

  const headerMap = asadaHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getDisplayValues();
  const occupiedEmails = new Set();
  const rowsToDelete = [];

  rows.forEach((row, index) => {
    const email = asadaNormalizeEmail_(row[headerMap.Correo]);
    if (email) {
      occupiedEmails.add(email);
    }
  });

  rows.forEach((row, index) => {
    const email = asadaNormalizeEmail_(row[headerMap.Correo]);
    const replacement = ASADA_ADMIN_EMAIL_MIGRATIONS[email];

    if (!replacement) {
      return;
    }

    const rowNumber = index + 2;

    if (occupiedEmails.has(replacement)) {
      rowsToDelete.push(rowNumber);
      return;
    }

    sheet
      .getRange(rowNumber, headerMap.Correo + 1)
      .setValue(replacement);
    occupiedEmails.add(replacement);
  });

  rowsToDelete
    .sort((a, b) => b - a)
    .forEach(rowNumber => sheet.deleteRow(rowNumber));

  const refreshedLastRow = sheet.getLastRow();

  if (refreshedLastRow < 2) {
    return;
  }

  const refreshedRows = sheet
    .getRange(2, 1, refreshedLastRow - 1, sheet.getLastColumn())
    .getDisplayValues();

  refreshedRows.forEach((row, index) => {
    const email = asadaNormalizeEmail_(row[headerMap.Correo]);
    const rowNumber = index + 2;

    const adminName = ASADA_ADMIN_EMAILS[email];

    if (adminName) {

      if (String(row[headerMap.Nombre] || "").trim() !== adminName) {
        sheet
          .getRange(rowNumber, headerMap.Nombre + 1)
          .setValue(adminName);
      }

      if (String(row[headerMap.Rol] || "").trim().toLowerCase() !== "admin") {
        sheet
          .getRange(rowNumber, headerMap.Rol + 1)
          .setValue("admin");
      }

      return;
    }

    const workerName = ASADA_WORKER_EMAILS[email];

    if (workerName) {
      if (String(row[headerMap.Nombre] || "").trim() !== workerName) {
        sheet
          .getRange(rowNumber, headerMap.Nombre + 1)
          .setValue(workerName);
      }

      if (String(row[headerMap.Rol] || "").trim().toLowerCase() !== "worker") {
        sheet
          .getRange(rowNumber, headerMap.Rol + 1)
          .setValue("worker");
      }

      if (!asadaValueIsActive_(row[headerMap.Activo])) {
        sheet
          .getRange(rowNumber, headerMap.Activo + 1)
          .setValue("Sí");
      }

      return;
    }

    if (
      ASADA_DISABLED_EMAILS.includes(email) &&
      String(row[headerMap.Activo] || "").trim().toLowerCase() !== "no"
    ) {
      sheet
        .getRange(rowNumber, headerMap.Activo + 1)
        .setValue("No");
    }

  });
}

function asadaHeaderMap_(sheet) {

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(value => String(value || "").trim());

  const map = {};
  headers.forEach((header, index) => {
    if (header) {
      map[header] = index;
    }
  });

  return map;
}

function asadaValueIsActive_(value) {

  const text = String(value === undefined || value === null ? "" : value)
    .trim()
    .toLowerCase();

  return ![
    "no",
    "false",
    "0",
    "inactivo",
    "inactiva"
  ].includes(text);
}

function asadaGetUserContext_(sessionToken) {

  const email = asadaGetActiveEmail_(sessionToken);
  const user = asadaFindUserByEmail_(email);

  if (!user) {
    throw new Error(
      "El correo no está registrado en la hoja Usuarios."
    );
  }

  return user;
}

function asadaRequireAdmin_(sessionToken) {

  const user = asadaGetUserContext_(sessionToken);

  if (!user.isAdmin) {
    throw new Error(
      "Esta operación está disponible únicamente para administradores."
    );
  }

  return user;
}

function asadaAuthorizeAction_(action, payload) {

  const user = asadaGetUserContext_(payload && payload.sessionToken);
  const normalizedAction = String(action || "").trim();

  if (user.isAdmin) {
    return user;
  }

  const publicActions = [
    "ping",
    "getCurrentUser",
    "saveDraft",
    "getDraft",
    "deleteDraft",
    "saveRecord",
    "saveAccident",
    "saveFactibilidad"
  ];

  if (!publicActions.includes(normalizedAction)) {
    throw new Error(
      "Los trabajadores únicamente pueden crear registros y administrar sus propios borradores."
    );
  }

  if (normalizedAction === "saveRecord") {
    const record = payload.record || {};
    const mode = String(payload.mode || "create")
      .trim()
      .toLowerCase();

    if (mode !== "create" || String(record.id || "").trim()) {
      throw new Error(
        "Los trabajadores no pueden editar registros existentes."
      );
    }
  }

  if (normalizedAction === "saveAccident") {
    const accident = payload.accident || {};
    const mode = String(payload.mode || "create")
      .trim()
      .toLowerCase();

    if (mode !== "create" || String(accident.id || "").trim()) {
      throw new Error(
        "Los trabajadores no pueden editar daños o accidentes existentes."
      );
    }
  }

  if (normalizedAction === "saveFactibilidad") {
    const factibilidad = payload.factibilidad || payload || {};

    if (String(factibilidad.id || "").trim()) {
      throw new Error(
        "Los trabajadores no pueden editar inspecciones existentes."
      );
    }
  }

  return user;
}

function getCurrentUser(sessionToken) {

  const user = asadaGetUserContext_(sessionToken);

  return {
    email: user.email,
    name: user.name,
    role: user.role,
    isAdmin: user.isAdmin
  };
}

/* =========================================================
   AUDITORÍA
   ========================================================= */

function asadaGetAuditSheet_() {

  return asadaGetOrCreateSheet_(
    ASADA_AUDIT_SHEET_NAME,
    ASADA_AUDIT_HEADERS
  );
}

function asadaGetPayloadRecordId_(payload) {

  payload = payload || {};

  return String(
    payload.id ||
    payload.record?.id ||
    payload.accident?.id ||
    payload.factibilidad?.id ||
    ""
  )
    .trim()
    .toUpperCase();
}

function asadaWriteAudit_(action, payload, detail) {

  try {
    if (!payload || !payload.sessionToken) {
      return;
    }

    const user = asadaGetUserContext_(payload && payload.sessionToken);
    const sheet = asadaGetAuditSheet_();

    sheet.appendRow([
      new Date(),
      user.email,
      user.role,
      String(action || "").trim(),
      asadaGetPayloadRecordId_(payload),
      String(detail || "").trim()
    ]);
  } catch (error) {
    console.error("No fue posible escribir la auditoría.", error);
  }
}

/*
    Comparte una carpeta o una hoja con un administrador.

    Ronald y María utilizan correos de Microsoft 365 sin una cuenta Google.
    Para ellos Google Drive necesita enviar una invitación de visitante. Por
    eso sendNotificationEmail debe ser true en este caso.

    Debe habilitarse una vez en Apps Script:
    Servicios > Drive API > Agregar.
*/
function asadaGrantViewer_(file, email) {

  const permissions = typeof Drive !== "undefined"
    ? Drive.Permissions
    : null;

  const createPermission = permissions &&
    typeof permissions.create === "function"
    ? function (resource, fileId) {
        return permissions.create(
          resource,
          fileId,
          {
            sendNotificationEmail: true,
            supportsAllDrives: true
          }
        );
      }
    : permissions &&
      typeof permissions.insert === "function"
      ? function (resource, fileId) {
          return permissions.insert(
            resource,
            fileId,
            {
              // Drive API v2 utiliza el nombre en plural.
              sendNotificationEmails: true,
              supportsAllDrives: true
            }
          );
        }
      : null;

  if (
    !file ||
    !email ||
    !createPermission
  ) {
    return false;
  }

  try {
    const existingViewer = file
      .getViewers()
      .some(viewer => {
        try {
          return String(viewer.getEmail() || "")
            .trim()
            .toLowerCase() === String(email)
            .trim()
            .toLowerCase();
        } catch (viewerError) {
          return false;
        }
      });

    if (existingViewer) {
      return true;
    }

    createPermission(
      {
        type: "user",
        role: "reader",
        emailAddress: email
      },
      file.getId()
    );

    return true;

  } catch (error) {
    const errorText = String(error && error.message || error || "");

    if (!/already exists|duplicate|already has access|permission/i.test(errorText)) {
      console.error(
        "No fue posible compartir la carpeta o la hoja con: " + email,
        error
      );
    }

    return false;
  }
}

/*
    Las evidencias no se publican con “cualquiera que tenga el enlace”.
    Los archivos se dejan privados. El acceso administrativo se concede en
    las carpetas principales, de modo que las fotografías y PDFs nuevos
    hereden el permiso sin enviar una invitación por cada archivo.
*/
function asadaShareFileWithAdmins_(file) {

  if (!file) {
    return;
  }

  try {
    file.setSharing(
      DriveApp.Access.PRIVATE,
      DriveApp.Permission.VIEW
    );
  } catch (error) {
    console.error("No fue posible cambiar la visibilidad del archivo.", error);
  }

  Object.keys(ASADA_ADMIN_EMAIL_MIGRATIONS).forEach(oldEmail => {
    try {
      file.removeViewer(oldEmail);
    } catch (error) {
      // El correo anterior puede no tener acceso a este archivo.
    }
  });
}

function asadaShareFolderWithAdmins_(folder) {

  if (!folder) {
    return false;
  }

  try {
    folder.setSharing(
      DriveApp.Access.PRIVATE,
      DriveApp.Permission.VIEW
    );
  } catch (error) {
    console.error(
      "No fue posible dejar privada la carpeta: " + folder.getName(),
      error
    );
  }

  Object.keys(ASADA_ADMIN_EMAILS).forEach(email => {
    try {
      const owner = folder.getOwner();
      const ownerEmail = owner
        ? String(owner.getEmail() || "").trim().toLowerCase()
        : "";

      if (ownerEmail === String(email).trim().toLowerCase()) {
        return;
      }

      asadaGrantViewer_(folder, email);
    } catch (error) {
      console.error(
        "No fue posible compartir la carpeta administrativa con: " + email,
        error
      );
    }
  });

  return true;
}

function asadaShareSpreadsheetWithAdmins_() {

  try {
    const spreadsheet = getSpreadsheet();
    const file = DriveApp.getFileById(spreadsheet.getId());

    try {
      file.setSharing(
        DriveApp.Access.PRIVATE,
        DriveApp.Permission.VIEW
      );
    } catch (error) {
      console.error("No fue posible dejar privada la base de datos.", error);
    }

    Object.keys(ASADA_ADMIN_EMAILS).forEach(email => {
      try {
        const owner = file.getOwner();
        const ownerEmail = owner
          ? String(owner.getEmail() || "").trim().toLowerCase()
          : "";

        if (ownerEmail !== String(email).trim().toLowerCase()) {
          asadaGrantViewer_(file, email);
        }
      } catch (error) {
        console.error(
          "No fue posible compartir la base de datos con: " + email,
          error
        );
      }
    });

    return true;
  } catch (error) {
    console.error("No fue posible compartir la base de datos.", error);
    return false;
  }
}

/* =========================================================
   BORRADORES SINCRONIZADOS
   ========================================================= */

function asadaNormalizeDraftType_(value) {

  const type = String(value || "")
    .trim()
    .toLowerCase();

  if (!ASADA_DRAFT_TYPES.includes(type)) {
    throw new Error("El tipo de borrador no es válido.");
  }

  return type;
}

function asadaNormalizeClientId_(value) {

  const clientId = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  return clientId || "principal";
}

function asadaGetDraftsSheet_() {

  const sheet = asadaGetOrCreateSheet_(
    ASADA_DRAFTS_SHEET_NAME,
    ASADA_DRAFT_HEADERS
  );

  return asadaNormalizeDraftSheet_(sheet);
}

function asadaGetDraftRow_(sheet, email, type, clientId) {

  const headerMap = asadaHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  clientId = asadaNormalizeClientId_(clientId);

  if (lastRow < 2) {
    return null;
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getDisplayValues();

  for (let index = 0; index < rows.length; index++) {
    const rowEmail = String(rows[index][headerMap.Correo] || "")
      .trim()
      .toLowerCase();
    const rowType = String(rows[index][headerMap.Tipo] || "")
      .trim()
      .toLowerCase();
    const rowClientId = asadaNormalizeClientId_(
      rows[index][headerMap.ClienteID]
    );

    if (
      rowEmail === email &&
      rowType === type &&
      (
        rowClientId === clientId ||
        !String(rows[index][headerMap.ClienteID] || "").trim()
      )
    ) {
      return {
        rowNumber: index + 2,
        row: rows[index],
        headerMap
      };
    }
  }

  return null;
}

function asadaGetDraftsRootFolder_() {

  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty("ASADA_DRAFTS_FOLDER_ID");

  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (error) {
      properties.deleteProperty("ASADA_DRAFTS_FOLDER_ID");
    }
  }

  const rootFolders = DriveApp.getRootFolder()
    .getFoldersByName(ASADA_DRAFTS_FOLDER_NAME);

  const folder = rootFolders.hasNext()
    ? rootFolders.next()
    : DriveApp.getRootFolder().createFolder(ASADA_DRAFTS_FOLDER_NAME);

  properties.setProperty("ASADA_DRAFTS_FOLDER_ID", folder.getId());
  return folder;
}

function asadaGetDraftFolder_(email, type) {

  const root = asadaGetDraftsRootFolder_();
  const safeEmail = Utilities.base64EncodeWebSafe(email)
    .replace(/=+$/g, "");
  const accountFolders = root.getFoldersByName(safeEmail);
  const accountFolder = accountFolders.hasNext()
    ? accountFolders.next()
    : root.createFolder(safeEmail);
  const typeFolders = accountFolder.getFoldersByName(type);

  return typeFolders.hasNext()
    ? typeFolders.next()
    : accountFolder.createFolder(type);
}

function asadaParseDraftDataUrl_(value) {

  const data = String(value || "").trim();
  const match = data.match(
    /^data:([^;,]+)(?:;[^,]*)*;base64,([\s\S]+)$/i
  );

  if (!match) {
    throw new Error("Uno de los archivos del borrador no es válido.");
  }

  const bytes = Utilities.base64Decode(
    match[2].replace(/\s/g, "")
  );

  if (bytes.length > ASADA_DRAFT_MAX_FILE_BYTES) {
    throw new Error(
      "Un archivo del borrador supera el tamaño máximo de 6 MB."
    );
  }

  const mimeType = match[1].toLowerCase();

  if (
    mimeType.indexOf("image/") !== 0 &&
    mimeType.indexOf("video/") !== 0
  ) {
    throw new Error("Los borradores solo pueden contener imágenes o videos.");
  }

  return {
    mimeType,
    bytes
  };
}

function asadaDraftExtension_(mimeType) {

  const value = String(mimeType || "").toLowerCase();
  const extension = value.split("/")[1] || "bin";

  return extension
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8) || "bin";
}

function asadaTrashDraftFiles_(metadata) {

  if (!Array.isArray(metadata)) {
    return;
  }

  metadata.forEach(item => {
    const fileId = String(item?.fileId || "").trim();

    if (!fileId) {
      return;
    }

    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      console.error("No fue posible eliminar un archivo de borrador.", error);
    }
  });
}

function saveDraft(input, sessionToken) {

  const lock = LockService.getScriptLock();
  lock.waitLock(120000);

  try {
    const user = asadaGetUserContext_(sessionToken);
    input = input || {};

  const type = asadaNormalizeDraftType_(input.tipo);
  const clientId = asadaNormalizeClientId_(input.clienteId);
  const profile = asadaDraftProfile_(
    user.email,
    clientId,
    input.operador
  );
  const data = input.datos && typeof input.datos === "object"
    ? input.datos
    : {};
  const files = Array.isArray(input.archivos)
    ? input.archivos
    : [];
  const dataJson = JSON.stringify(data);

  if (dataJson.length > 45000) {
    throw new Error("El contenido textual del borrador es demasiado grande.");
  }

  let totalBytes = 0;
  const folder = asadaGetDraftFolder_(user.email, type);
  const sheet = asadaGetDraftsSheet_();
  const previous = asadaGetDraftRow_(sheet, user.email, type, clientId);

  if (previous) {
    const previousFiles = asadaParseJson_(
      previous.row[previous.headerMap.ArchivosJSON],
      []
    );
    asadaTrashDraftFiles_(previousFiles);
  }

  const metadata = [];
  const now = new Date();

  files.forEach((item, index) => {
    const parsed = asadaParseDraftDataUrl_(item?.data);
    totalBytes += parsed.bytes.length;

    if (totalBytes > ASADA_DRAFT_MAX_TOTAL_BYTES) {
      throw new Error(
        "Los archivos del borrador superan el tamaño total permitido de 18 MB."
      );
    }

    const filename =
      "Borrador_" +
      type +
      "_" +
      now.getTime() +
      "_" +
      (index + 1) +
      "." +
      asadaDraftExtension_(parsed.mimeType);

    const file = folder.createFile(
      Utilities.newBlob(parsed.bytes, parsed.mimeType, filename)
    );

    metadata.push({
      fileId: file.getId(),
      name: String(item?.name || filename),
      mimeType: parsed.mimeType,
      size: parsed.bytes.length
    });
  });

  const rowValues = [
    user.email + "|" + profile + "|" + clientId + "|" + type,
    user.email,
    profile,
    type,
    clientId,
    dataJson,
    JSON.stringify(metadata),
    previous
      ? previous.row[previous.headerMap.FechaCreacion] || now
      : now,
    now
  ];

  if (previous) {
    sheet
      .getRange(previous.rowNumber, 1, 1, ASADA_DRAFT_HEADERS.length)
      .setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  asadaWriteAudit_(
    "saveDraft",
    { sessionToken },
    type
  );

    return {
      tipo: type,
      perfil: profile,
      fechaActualizacion: now
    };
  } finally {
    lock.releaseLock();
  }
}

function getDraft(type, sessionToken, clientId) {

  const lock = LockService.getScriptLock();
  lock.waitLock(120000);

  try {
    const user = asadaGetUserContext_(sessionToken);
    type = asadaNormalizeDraftType_(type);
    clientId = asadaNormalizeClientId_(clientId);

  const sheet = asadaGetDraftsSheet_();
  const found = asadaGetDraftRow_(sheet, user.email, type, clientId);

    if (!found) {
      return null;
    }

  const data = asadaParseJson_(
    found.row[found.headerMap.DatosJSON],
    {}
  );
  const metadata = asadaParseJson_(
    found.row[found.headerMap.ArchivosJSON],
    []
  );
  const files = [];

  metadata.forEach(item => {
    const fileId = String(item?.fileId || "").trim();

    if (!fileId) {
      return;
    }

    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      files.push({
        name: file.getName(),
        mimeType: blob.getContentType(),
        data:
          "data:" +
          blob.getContentType() +
          ";base64," +
          Utilities.base64Encode(blob.getBytes())
      });
    } catch (error) {
      console.error("No fue posible leer un archivo de borrador.", error);
    }
  });

    return {
      tipo: type,
      perfil: String(found.row[found.headerMap.Perfil] || "").trim(),
      clienteId,
      datos: data,
      archivos: files,
      fechaCreacion: found.row[found.headerMap.FechaCreacion],
      fechaActualizacion: found.row[found.headerMap.FechaActualizacion]
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteDraft(type, sessionToken, clientId) {

  const lock = LockService.getScriptLock();
  lock.waitLock(120000);

  try {
    const user = asadaGetUserContext_(sessionToken);
    type = asadaNormalizeDraftType_(type);
    clientId = asadaNormalizeClientId_(clientId);

  const sheet = asadaGetDraftsSheet_();
  const found = asadaGetDraftRow_(sheet, user.email, type, clientId);

    if (!found) {
      return { deleted: false };
    }

  const metadata = asadaParseJson_(
    found.row[found.headerMap.ArchivosJSON],
    []
  );
  asadaTrashDraftFiles_(metadata);
  sheet.deleteRow(found.rowNumber);

  asadaWriteAudit_(
    "deleteDraft",
    { sessionToken },
    type
  );

    return { deleted: true };
  } finally {
    lock.releaseLock();
  }
}

function asadaParseJson_(value, fallback) {

  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
}

/* =========================================================
   ELIMINACIÓN ADMINISTRATIVA

   Los archivos de accidentes y factibilidades no se envían a
   la papelera: la política indicada exige conservar fotografías
   y reportes. La eliminación quita el registro consultable de
   Sheets y deja la evidencia en Drive para conservación histórica.
   ========================================================= */

function deleteVehicleRecord(id, sessionToken) {

  const lock = LockService.getScriptLock();
  lock.waitLock(120000);

  try {
    asadaRequireAdmin_(sessionToken);

  const normalizedId = normalizeRecordId(id);
  const sheet = getRecordsSheet();
  const rowNumber = findRecordRowById(sheet, normalizedId);

  if (rowNumber === -1) {
    throw new Error("No se encontró la revisión que desea eliminar.");
  }

  const record = getRecordFromRow(sheet, rowNumber);
  const files = Array.isArray(record?.imagenes)
    ? record.imagenes
    : [];

  files.forEach(item => {
    if (item?.fileId) {
      trashDriveFileById(item.fileId);
    }
  });

  if (record?.videoCondicion?.fileId) {
    trashDriveFileById(record.videoCondicion.fileId);
  }

    sheet.deleteRow(rowNumber);
    return { deleted: true, id: normalizedId };
  } finally {
    lock.releaseLock();
  }
}

function deleteAccidentRecord(id, sessionToken) {

  const lock = LockService.getScriptLock();
  lock.waitLock(120000);

  try {
    asadaRequireAdmin_(sessionToken);

  const normalizedId = normalizeRecordId(id);
  const sheet = getAccidentsSheet();
  const rowNumber = findRecordRowById(sheet, normalizedId);

  if (rowNumber === -1) {
    throw new Error("No se encontró el daño o accidente que desea eliminar.");
  }

    sheet.deleteRow(rowNumber);
    return { deleted: true, id: normalizedId };
  } finally {
    lock.releaseLock();
  }
}

function deleteFactibilidadRecord(id, sessionToken) {

  const lock = LockService.getScriptLock();
  lock.waitLock(120000);

  try {
    asadaRequireAdmin_(sessionToken);

  const normalizedId = String(id || "").trim().toUpperCase();
  const sheet = factibilidadGetSheet_();
  const headers = factibilidadGetHeaders_(sheet);
  const found = factibilidadFindRow_(sheet, headers, normalizedId);

  if (!found) {
    throw new Error("No se encontró la inspección que desea eliminar.");
  }

    sheet.deleteRow(found.rowNumber);
    return { deleted: true, id: normalizedId };
  } finally {
    lock.releaseLock();
  }
}

function asadaPrivatizeFolderTree_(folder) {

  // También se protegen las subcarpetas que pudieran tener un permiso
  // público explícito de una versión anterior.
  asadaShareFileWithAdmins_(folder);

  const files = folder.getFiles();

  while (files.hasNext()) {
    asadaShareFileWithAdmins_(
      files.next()
    );
  }

  const folders = folder.getFolders();

  while (folders.hasNext()) {
    asadaPrivatizeFolderTree_(
      folders.next()
    );
  }
}

/*
    Ejecútela una vez si antes existían archivos compartidos con enlace.
    No borra archivos; solamente limita su visibilidad a los administradores.
*/
function privatizarArchivosASADA() {

  asadaShareSpreadsheetWithAdmins_();

  asadaPrivatizeFolderTree_(
    asadaGetDraftsRootFolder_()
  );

  try {
    const factibilidadRoot = factibilidadGetRootFolder_();
    asadaPrivatizeFolderTree_(factibilidadRoot);
    asadaShareFolderWithAdmins_(factibilidadRoot);
  } catch (error) {
    console.error("No se pudo proteger la carpeta de factibilidades.", error);
  }

  try {
    const carsFolder = getCarsFolder();
    asadaPrivatizeFolderTree_(carsFolder);
    asadaShareFolderWithAdmins_(carsFolder);
  } catch (error) {
    console.error("No se pudo proteger la carpeta de vehículos.", error);
  }

  try {
    const accidentsRoot = getAccidentsRootFolder();
    asadaPrivatizeFolderTree_(accidentsRoot);
    asadaShareFolderWithAdmins_(accidentsRoot);
  } catch (error) {
    console.error("No se pudo proteger la carpeta de accidentes.", error);
  }

  SpreadsheetApp.flush();
  Logger.log(
    "Base de datos y carpetas protegidas. Los administradores reciben una invitación de visitante."
  );
  return true;
}

/* =========================================================
   CONFIGURACIÓN MANUAL
   ========================================================= */

function prepararSeguridadASADA() {

  asadaEnsureUsersSheet_();
  asadaGetAuditSheet_();
  asadaGetDraftsSheet_();

  SpreadsheetApp.flush();

  Logger.log(
    "Hojas Usuarios, Auditoria y Borradores preparadas correctamente."
  );

  return true;
}
