/**
 * Google Sheet shipment sync for Insta-Track.
 *
 * Script properties required:
 * - INSTA_TRACK_WEBHOOK_URL: https://your-domain/api/v1/shipments/webhook/google-sheet
 * - INSTA_TRACK_API_KEY: optional, only if API_KEY is enabled on the backend
 */

const SHIPMENT_SYNC_HEADERS = {
  ship_to_location: ['ship_to_location', 'ship to location', 'ship to', 'destination'],
  client_name: ['client_name', 'client name', 'client'],
  booking_date: ['booking_date', 'booking date', 'booking dt.', 'booking dt'],
  show_date: ['show_date', 'show date'],
  show_city: ['show_city', 'show city'],
  cs_type: ['cs_type', 'c/s', 'cs', 'cs type'],
  no_of_box: ['no_of_box', 'no of box', 'boxes', 'box'],
  courier: ['courier', 'carrier'],
  master_awb: ['master_awb', 'master awb', 'master tracking', 'master tracking number'],
  child_awb: ['child_awb', 'child awb', 'child awb #', 'child tracking', 'child tracking number'],
  remarks: ['remarks', 'remark'],
};

function syncShipmentsToInstaTrack() {
  const started = Date.now();
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('INSTA_TRACK_WEBHOOK_URL');
  const apiKey = props.getProperty('INSTA_TRACK_API_KEY');

  if (!webhookUrl) {
    SpreadsheetApp.getUi().alert('Missing INSTA_TRACK_WEBHOOK_URL script property.');
    return;
  }

  const sheet = SpreadsheetApp.getActiveSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert('No shipment rows found.');
    return;
  }

  const headerMap = buildShipmentHeaderMap_(values[0]);
  const rows = [];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const payloadRow = buildShipmentPayloadRow_(row, headerMap, i + 1);
    if (payloadRow.master_awb || payloadRow.child_awb) {
      rows.push(payloadRow);
    }
  }

  if (!rows.length) {
    SpreadsheetApp.getUi().alert('No rows with Master AWB or Child AWB were found.');
    return;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      rows,
      track_live: false,
    }),
    headers: apiKey ? { 'X-API-Key': apiKey } : {},
  };

  const response = UrlFetchApp.fetch(webhookUrl, options);
  const body = response.getContentText();
  let result;
  try {
    result = JSON.parse(body);
  } catch (err) {
    SpreadsheetApp.getUi().alert(`Sync failed: backend returned a non-JSON response.\n\n${body.slice(0, 500)}`);
    return;
  }

  const elapsedSeconds = ((Date.now() - started) / 1000).toFixed(1);
  const failureLines = (result.failures || [])
    .slice(0, 8)
    .map((failure) => `Row ${failure.row_number}: ${failure.reason}`)
    .join('\n');

  const summary = [
    `Shipment sync completed in ${elapsedSeconds}s`,
    `Received: ${result.received || rows.length}`,
    `Imported: ${result.imported || result.success || 0}`,
    `Failed: ${result.failed || 0}`,
    `Skipped: ${result.skipped || 0}`,
    result.tracking_mode ? `Mode: ${result.tracking_mode}` : '',
    failureLines ? `\nFailures:\n${failureLines}` : '',
    (result.failures || []).length > 8 ? `\n...and ${(result.failures || []).length - 8} more failure(s). Check response logs.` : '',
  ].filter(Boolean).join('\n');

  SpreadsheetApp.getUi().alert(summary);
}

function buildShipmentHeaderMap_(headerRow) {
  const normalizedHeaders = headerRow.map((value) => normalizeHeader_(value));
  const map = {};

  Object.keys(SHIPMENT_SYNC_HEADERS).forEach((field) => {
    const aliases = SHIPMENT_SYNC_HEADERS[field].map(normalizeHeader_);
    const index = normalizedHeaders.findIndex((header) => aliases.indexOf(header) !== -1);
    map[field] = index;
  });

  return map;
}

function buildShipmentPayloadRow_(row, headerMap, rowNumber) {
  const payload = { row_number: rowNumber };
  Object.keys(SHIPMENT_SYNC_HEADERS).forEach((field) => {
    const index = headerMap[field];
    payload[field] = index >= 0 ? String(row[index] || '').trim() : '';
  });
  return payload;
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[#.]/g, '')
    .replace(/\s+/g, ' ');
}
