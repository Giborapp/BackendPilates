import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type OpenApiDocument = { paths?: Record<string, unknown> };

describe('OpenAPI snapshot', () => {
  it('contains the public intake and replacement contracts', async () => {
    const document = JSON.parse(await readFile(resolve(__dirname, '../../../docs/openapi.json'), 'utf8')) as OpenApiDocument;
    const paths = Object.keys(document.paths ?? {});
    expect(paths).toEqual(expect.arrayContaining(['/public/anamnese/{token}', '/public/intakes/invites', '/replacement-links/{token}', '/replacement-links/{token}/reserve']));
  });
});
