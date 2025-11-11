const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const DEFAULT_CREDENTIAL_FILE = 'calendariomonad-af3e396d2700.json';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const MAX_RESULTS = parseInt(process.env.GOOGLE_CALENDAR_MAX_RESULTS || '50', 10);

let authClient = null;
let credentialsCache = null;

function resolveCredentialsPath() {
  const customPath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH;
  if (customPath) {
    return path.isAbsolute(customPath)
      ? customPath
      : path.join(process.cwd(), customPath);
  }

  return path.join(process.cwd(), 'config', DEFAULT_CREDENTIAL_FILE);
}

function loadCredentials() {
  if (credentialsCache) {
    return credentialsCache;
  }

  const credentialsPath = resolveCredentialsPath();

  try {
    const raw = fs.readFileSync(credentialsPath, 'utf8');
    credentialsCache = JSON.parse(raw);
    return credentialsCache;
  } catch (error) {
    throw new Error(
      `No se pudo leer las credenciales de Google Calendar. Verifica que el archivo exista en ${credentialsPath}. Error: ${error.message}`
    );
  }
}

function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  const credentials = loadCredentials();
  const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

  authClient = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    scopes
  );

  return authClient;
}

function normalizeRange(range) {
  switch (range) {
    case 'today':
    case '3days':
    case 'week':
    case 'month':
      return range;
    default:
      return 'today';
  }
}

function computeRange(range) {
  const normalized = normalizeRange(range);
  const now = new Date();

  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  ));

  const end = new Date(start);

  switch (normalized) {
    case '3days':
      end.setUTCDate(end.getUTCDate() + 3);
      break;
    case 'week':
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    case 'month':
      end.setUTCDate(end.getUTCDate() + 30);
      break;
    case 'today':
    default:
      end.setUTCDate(end.getUTCDate() + 1);
      break;
  }

  // Ajustar a fin del día para rangos > hoy
  end.setUTCHours(23, 59, 59, 999);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString()
  };
}

async function getCalendarEvents(range = 'today') {
  if (!CALENDAR_ID) {
    throw new Error('Falta configurar GOOGLE_CALENDAR_ID en el entorno.');
  }

  const auth = getAuthClient();
  await auth.authorize();

  const calendar = google.calendar({ version: 'v3', auth });
  const { timeMin, timeMax } = computeRange(range);

  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: MAX_RESULTS
  });

  const items = response.data?.items || [];
  return items.filter(event => event.status !== 'cancelled');
}

async function getCalendarEventsBetween(timeMinISO, timeMaxISO) {
  if (!CALENDAR_ID) {
    throw new Error('Falta configurar GOOGLE_CALENDAR_ID en el entorno.');
  }

  if (!timeMinISO || !timeMaxISO) {
    throw new Error('Se requieren timeMin y timeMax para obtener eventos entre fechas.');
  }

  const auth = getAuthClient();
  await auth.authorize();

  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: MAX_RESULTS
  });

  const items = response.data?.items || [];
  return items.filter(event => event.status !== 'cancelled');
}

module.exports = {
  getCalendarEvents,
  getCalendarEventsBetween
};

