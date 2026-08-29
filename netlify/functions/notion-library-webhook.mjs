import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  evaluateWebhookAction,
  isSystemAuthoredWebhook,
  propertyModel,
  readJson,
  retrievePage
} from '../../scripts/notion/library-framework.mjs';

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function trusted(rawBody, signature, token) {
  if (!token || !signature) return false;
  const expected = `sha256=${createHmac('sha256', token)
    .update(rawBody)
    .digest('hex')}`;
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function triggerBuild(hook, event) {
  const result = await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      trigger: 'notion-library',
      eventId: event.id,
      eventType: event.type,
      pageId: event.entity?.id
    })
  });
  if (!result.ok) {
    throw new Error(`Netlify build hook returned ${result.status}.`);
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed.' });
  }
  const rawBody = event.body ?? '{}';
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return response(400, { error: 'Invalid JSON.' });
  }

  if (payload.verification_token) {
    console.log('Notion webhook verification token received.');
    return response(200, { verified: true });
  }

  const signature =
    event.headers?.['x-notion-signature'] ??
    event.headers?.['X-Notion-Signature'];
  if (
    !trusted(rawBody, signature, process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN)
  ) {
    return response(401, { error: 'Invalid Notion signature.' });
  }
  if (isSystemAuthoredWebhook(payload)) {
    return response(202, {
      ignored: true,
      reason: 'Integration-authored system update.'
    });
  }

  const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_TOKEN;
  const buildHook = process.env.NETLIFY_LIBRARY_BUILD_HOOK;
  if (!notionToken || !buildHook) {
    return response(503, { error: 'Webhook environment is incomplete.' });
  }

  const [ledger, notionConfig] = await Promise.all([
    readJson('world/structures/library/construction-ledger.json'),
    readJson('world/structures/library/notion.json')
  ]);
  const pageId = payload.entity?.id;
  if (!pageId || payload.entity?.type !== 'page') {
    return response(202, { ignored: true, reason: 'Not a page event.' });
  }
  const record = ledger.records.find(
    (item) => item.source === 'notion' && item.notionPageId === pageId
  );

  if (payload.type === 'page.deleted' || payload.type === 'page.moved') {
    if (record) await triggerBuild(buildHook, payload);
    return response(202, {
      buildTriggered: Boolean(record),
      reason: record
        ? 'Constructed Library page was removed or moved.'
        : 'Page is not a constructed Library entry.'
    });
  }

  let page;
  try {
    page = await retrievePage(notionToken, pageId);
  } catch (error) {
    console.error(error);
    return response(202, {
      ignored: true,
      reason: 'Unable to retrieve the changed page.'
    });
  }
  const parentId = String(
    page.parent?.data_source_id ?? page.parent?.database_id ?? ''
  ).replaceAll('-', '');
  const itemSource = Object.entries(notionConfig.dataSources?.items ?? {}).find(
    ([, source]) => source.dataSourceId.replaceAll('-', '') === parentId
  );
  if (!itemSource && !record) {
    return response(202, { ignored: true, reason: 'Outside nested Library Items data sources.' });
  }

  const entry = propertyModel(page, 'item', record?.parentId ?? itemSource?.[0] ?? '');
  const action = evaluateWebhookAction(entry, record);
  if (action.build) await triggerBuild(buildHook, payload);
  return response(202, {
    buildTriggered: action.build,
    reason: action.reason
  });
}
